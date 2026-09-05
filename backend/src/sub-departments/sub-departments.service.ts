import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateSubDepartmentDto, UpdateSubDepartmentDto } from './dto/sub-department.dto';

@Injectable()
export class SubDepartmentsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(dto: CreateSubDepartmentDto, actorId?: string) {
    const existing = await this.prisma.subDepartment.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Sub-department code already exists');

    const subDepartment = await this.prisma.subDepartment.create({ data: dto });
    await this.auditService.log({
      userId: actorId,
      action: 'SUB_DEPARTMENT_CREATED',
      entity: 'SubDepartment',
      entityId: subDepartment.id,
      details: `Created sub-department ${subDepartment.name}`,
    });
    return subDepartment;
  }

  findAll(departmentId?: string) {
    return this.prisma.subDepartment.findMany({
      where: departmentId ? { departmentId } : undefined,
      orderBy: { name: 'asc' },
      include: {
        department: { select: { id: true, name: true } },
        _count: { select: { employees: true, sections: true } },
      },
    });
  }

  async findOne(id: string) {
    const subDepartment = await this.prisma.subDepartment.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
        _count: { select: { employees: true, sections: true } },
      },
    });
    if (!subDepartment) throw new NotFoundException('Sub-department not found');
    return subDepartment;
  }

  async update(id: string, dto: UpdateSubDepartmentDto, actorId?: string) {
    await this.findOne(id);
    const subDepartment = await this.prisma.subDepartment.update({ where: { id }, data: dto });
    await this.auditService.log({
      userId: actorId,
      action: 'SUB_DEPARTMENT_UPDATED',
      entity: 'SubDepartment',
      entityId: id,
    });
    return subDepartment;
  }

  async remove(id: string, actorId?: string) {
    await this.findOne(id);
    await this.prisma.subDepartment.delete({ where: { id } });
    await this.auditService.log({
      userId: actorId,
      action: 'SUB_DEPARTMENT_DELETED',
      entity: 'SubDepartment',
      entityId: id,
    });
    return { success: true };
  }
}
