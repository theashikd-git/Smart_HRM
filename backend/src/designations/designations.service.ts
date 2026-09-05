import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateDesignationDto, UpdateDesignationDto } from './dto/designation.dto';

@Injectable()
export class DesignationsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(dto: CreateDesignationDto, actorId?: string) {
    const existing = await this.prisma.designation.findUnique({ where: { title: dto.title } });
    if (existing) throw new ConflictException('Designation already exists');

    const designation = await this.prisma.designation.create({ data: dto });
    await this.auditService.log({
      userId: actorId,
      action: 'DESIGNATION_CREATED',
      entity: 'Designation',
      entityId: designation.id,
    });
    return designation;
  }

  findAll() {
    return this.prisma.designation.findMany({
      orderBy: { title: 'asc' },
      include: { _count: { select: { employees: true } } },
    });
  }

  async findOne(id: string) {
    const designation = await this.prisma.designation.findUnique({ where: { id } });
    if (!designation) throw new NotFoundException('Designation not found');
    return designation;
  }

  async update(id: string, dto: UpdateDesignationDto, actorId?: string) {
    await this.findOne(id);
    const designation = await this.prisma.designation.update({ where: { id }, data: dto });
    await this.auditService.log({
      userId: actorId,
      action: 'DESIGNATION_UPDATED',
      entity: 'Designation',
      entityId: id,
    });
    return designation;
  }

  async remove(id: string, actorId?: string) {
    await this.findOne(id);
    await this.prisma.designation.delete({ where: { id } });
    await this.auditService.log({
      userId: actorId,
      action: 'DESIGNATION_DELETED',
      entity: 'Designation',
      entityId: id,
    });
    return { success: true };
  }
}
