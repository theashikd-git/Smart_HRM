import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // A raw Prisma unique-constraint violation (P2002) means some service
    // method changed a @unique field (employeeCode, deviceUserId, etc.)
    // without pre-checking for a collision. Rather than let that surface
    // as an opaque 500 -- which from the UI just looks like "the save
    // silently failed" -- report it as the 409 conflict it actually is,
    // naming the field so the person editing the record knows why.
    if (exception instanceof Prisma.PrismaClientKnownRequestError && exception.code === 'P2002') {
      const fields = (exception.meta?.target as string[] | undefined)?.join(', ') || 'a field';
      response.status(HttpStatus.CONFLICT).json({
        statusCode: HttpStatus.CONFLICT,
        timestamp: new Date().toISOString(),
        message: `${fields} must be unique -- that value is already in use by another record`,
      });
      return;
    }

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    // A raw (non-HttpException) error used to always show as the opaque
    // "Internal server error" -- true details only ever reached the server
    // console via logger.error() below, which meant every unexpected 500
    // (a device timeout, a third-party library quirk, etc.) required
    // someone to go copy text out of a terminal window before it could be
    // diagnosed. This is an internal, single-tenant HR tool with no public
    // signup, so surfacing the real Error.message to the (already
    // authenticated) person who triggered it is safe and saves that whole
    // round trip -- the full stack trace still only goes to the server log.
    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : exception instanceof Error
          ? exception.message
          : 'Internal server error';

    if (status >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      ...(typeof message === 'string' ? { message } : (message as object)),
    });
  }
}
