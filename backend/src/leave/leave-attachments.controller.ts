import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import type { Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LeaveAttachmentsService } from './leave-attachments.service';
import { UPLOAD_DIR } from './leave-attachments.constants';

/**
 * Backs the Maternity Leave "attach document" requirement. Deliberately not
 * served as a static folder (`express.static`) -- these are potentially
 * sensitive medical/supporting documents, so downloading one goes through
 * JwtAuthGuard and an ownership/role check in the service instead of being
 * reachable by anyone who guesses or intercepts the URL.
 */
@ApiTags('Leave Attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('leave/attachments')
export class LeaveAttachmentsController {
  constructor(private service: LeaveAttachmentsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req: any, file: any, cb: any) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  async upload(@UploadedFile() file: any, @Body('employeeId') employeeId: string, @CurrentUser() user: any) {
    if (!file) throw new BadRequestException('No file was uploaded');
    // Employee self-service accounts may only attach to their own record --
    // whatever employeeId they sent (if any) is ignored in favor of their
    // linked employee. Other roles fall back to their own linked employee
    // too when no employeeId is given -- that covers a Manager attaching a
    // document while applying for their OWN leave from My Calendar (see
    // MyLeaveRequestModal, now also used from the Manager Portal), the same
    // self-service case as an EMPLOYEE login, just via a different Role. An
    // explicit employeeId still lets staff attach on behalf of someone else
    // (e.g. HR uploading for an employee who can't do it themselves).
    const targetEmployeeId = user.role === 'EMPLOYEE' ? user.employeeId : employeeId || user.employeeId;
    if (!targetEmployeeId) {
      throw new BadRequestException(
        user.role === 'EMPLOYEE' ? 'This login is not linked to an Employee record' : 'employeeId is required',
      );
    }
    return this.service.create(targetEmployeeId, file, user.id);
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @CurrentUser() user: any, @Res() res: Response) {
    const document = await this.service.findOneForDownload(id, user);
    return res.sendFile(document.absolutePath, {
      headers: { 'Content-Disposition': `inline; filename="${document.fileName}"` },
    });
  }
}

