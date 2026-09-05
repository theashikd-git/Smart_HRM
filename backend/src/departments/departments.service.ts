import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(dto: CreateDepartmentDto, actorId?: string) {
    const existing = await this.prisma.department.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Department code already exists');

    const department = await this.prisma.department.create({ data: dto });
    await this.auditService.log({
      userId: actorId,
      action: 'DEPARTMENT_CREATED',
      entity: 'Department',
      entityId: department.id,
      details: `Created department ${department.name}`,
    });
    return department;
  }

  findAll() {
    return this.prisma.department.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { employees: true } } },
    });
  }

  async findOne(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: { _count: { select: { employees: true } } },
    });
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  async update(id: string, dto: UpdateDepartmentDto, actorId?: string) {
    await this.findOne(id);
    const department = await this.prisma.department.update({ where: { id }, data: dto });
    await this.auditService.log({
      userId: actorId,
      action: 'DEPARTMENT_UPDATED',
      entity: 'Department',
      entityId: id,
    });
    return department;
  }

  async remove(id: string, actorId?: string) {
    await this.findOne(id);
    await this.prisma.department.delete({ where: { id } });
    await this.auditService.log({
      userId: actorId,
      action: 'DEPARTMENT_DELETED',
      entity: 'Department',
      entityId: id,
    });
    return { success: true };
  }
}
