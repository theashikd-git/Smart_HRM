import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateDepartmentSuperiorDto } from './dto/department-superior.dto';

@Injectable()
export class DepartmentSuperiorsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(dto: CreateDepartmentSuperiorDto, actorId?: string) {
    if (!dto.departmentId && !dto.subDepartmentId) {
      throw new BadRequestException('A department or sub-department must be specified');
    }

    const existing = await this.prisma.departmentSuperior.findFirst({
      where: {
        departmentId: dto.departmentId ?? null,
        subDepartmentId: dto.subDepartmentId ?? null,
        employeeId: dto.employeeId,
        title: dto.title,
      },
    });
    if (existing) throw new ConflictException('This employee already holds that title on this unit');

    const superior = await this.prisma.departmentSuperior.create({
      data: dto,
      include: {
        // account: the linked login (if any) -- this is what lets a Leave
        // Workflow tier's approver picker offer this person, since a leave
        // decision still has to be made by a logged-in User.
        employee: {
          select: { id: true, fullName: true, employeeCode: true, account: { select: { id: true, isActive: true } } },
        },
        department: { select: { id: true, name: true } },
        subDepartment: { select: { id: true, name: true } },
      },
    });
    await this.auditService.log({
      userId: actorId,
      action: 'DEPARTMENT_SUPERIOR_ASSIGNED',
      entity: 'DepartmentSuperior',
      entityId: superior.id,
      details: `Assigned ${superior.employee.fullName} as ${superior.title}`,
    });
    return superior;
  }

  findAll(departmentId?: string, subDepartmentId?: string) {
    return this.prisma.departmentSuperior.findMany({
      where: {
        ...(departmentId ? { departmentId } : {}),
        ...(subDepartmentId ? { subDepartmentId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        employee: {
          select: { id: true, fullName: true, employeeCode: true, account: { select: { id: true, isActive: true } } },
        },
        department: { select: { id: true, name: true } },
        subDepartment: { select: { id: true, name: true } },
      },
    });
  }

  async remove(id: string, actorId?: string) {
    const existing = await this.prisma.departmentSuperior.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Assignment not found');

    await this.prisma.departmentSuperior.delete({ where: { id } });
    await this.auditService.log({
      userId: actorId,
      action: 'DEPARTMENT_SUPERIOR_REMOVED',
      entity: 'DepartmentSuperior',
      entityId: id,
    });
    return { success: true };
  }
}
