import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateSectionDto, UpdateSectionDto } from './dto/section.dto';

@Injectable()
export class SectionsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(dto: CreateSectionDto, actorId?: string) {
    const existing = await this.prisma.section.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Section/Team code already exists');

    const section = await this.prisma.section.create({ data: dto });
    await this.auditService.log({
      userId: actorId,
      action: 'SECTION_CREATED',
      entity: 'Section',
      entityId: section.id,
      details: `Created section/team ${section.name}`,
    });
    return section;
  }

  findAll(departmentId?: string, subDepartmentId?: string) {
    return this.prisma.section.findMany({
      where: {
        ...(departmentId ? { departmentId } : {}),
        ...(subDepartmentId ? { subDepartmentId } : {}),
      },
      orderBy: { name: 'asc' },
      include: {
        department: { select: { id: true, name: true } },
        subDepartment: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
      },
    });
  }

  async findOne(id: string) {
    const section = await this.prisma.section.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
        subDepartment: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
      },
    });
    if (!section) throw new NotFoundException('Section/Team not found');
    return section;
  }

  async update(id: string, dto: UpdateSectionDto, actorId?: string) {
    await this.findOne(id);
    const section = await this.prisma.section.update({ where: { id }, data: dto });
    await this.auditService.log({
      userId: actorId,
      action: 'SECTION_UPDATED',
      entity: 'Section',
      entityId: id,
    });
    return section;
  }

  async remove(id: string, actorId?: string) {
    await this.findOne(id);
    await this.prisma.section.delete({ where: { id } });
    await this.auditService.log({
      userId: actorId,
      action: 'SECTION_DELETED',
      entity: 'Section',
      entityId: id,
    });
    return { success: true };
  }
}
