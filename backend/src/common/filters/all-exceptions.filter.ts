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

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
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
