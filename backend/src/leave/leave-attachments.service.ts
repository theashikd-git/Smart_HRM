import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { existsSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UPLOAD_DIR } from './leave-attachments.constants';

@Injectable()
export class LeaveAttachmentsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(employeeId: string, file: any, actorId?: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');

    const document = await this.prisma.document.create({
      data: {
        employeeId,
        type: 'Leave Attachment',
        fileName: file.originalname,
        // Just the stored (randomized) filename, not a full URL -- resolved
        // back against UPLOAD_DIR on download. This is a single-server,
        // on-premise deployment, so there's no external file host to point
        // to.
        fileUrl: file.filename,
      },
    });

    await this.auditService.log({
      userId: actorId,
      action: 'LEAVE_ATTACHMENT_UPLOADED',
      entity: 'Document',
      entityId: document.id,
      details: `Uploaded "${file.originalname}" for ${employee.fullName} (${employee.employeeCode})`,
    });

    return { id: document.id, fileName: document.fileName };
  }

  async findOneForDownload(id: string, user: any) {
    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document) throw new NotFoundException('Document not found');

    const isOwner = user.role === 'EMPLOYEE' && document.employeeId === user.employeeId;
    const isStaff = ['ADMIN', 'HR', 'MANAGER', 'SUPERVISOR'].includes(user.role);
    if (!isOwner && !isStaff) {
      throw new ForbiddenException('You do not have access to this document');
    }

    const absolutePath = join(UPLOAD_DIR, document.fileUrl);
    if (!existsSync(absolutePath)) {
      throw new NotFoundException('The stored file is missing');
    }

    return { fileName: document.fileName, absolutePath };
  }
}
