import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';

const INCLUDE = {
  manager: { select: { id: true, fullName: true } },
  _count: { select: { employees: true } },
  designations: {
    select: { designation: { select: { id: true, title: true, status: true } } },
    orderBy: { designation: { title: 'asc' } },
  },
} satisfies Prisma.DepartmentInclude;

type DepartmentRow = Prisma.DepartmentGetPayload<{ include: typeof INCLUDE }>;

/** `designations` becomes a flat list, plus a count for the department list. */
function shape(row: DepartmentRow) {
  const designations = row.designations.map((d) => d.designation);
  return { ...row, designations, designationCount: designations.length };
}

@Injectable()
export class DepartmentsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /** Every id must be a real designation; returns their titles for the audit log. */
  private async titlesOf(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.designation.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } });
    if (rows.length !== new Set(ids).size) throw new BadRequestException('One or more selected designations no longer exist');
    return new Map(rows.map((r) => [r.id, r.title]));
  }

  async create(dto: CreateDepartmentDto, actorId?: string) {
    const { designationIds = [], ...data } = dto;
    const existingCode = await this.prisma.department.findUnique({ where: { code: data.code } });
    if (existingCode) throw new ConflictException('Department code already exists');
    const titles = await this.titlesOf(designationIds);

    const department = await this.prisma.department.create({
      data: { ...data, designations: { create: designationIds.map((designationId) => ({ designationId })) } },
      include: INCLUDE,
    });

    await this.auditService.log({
      userId: actorId,
      action: 'DEPARTMENT_CREATED',
      entity: 'Department',
      entityId: department.id,
      details: JSON.stringify({
        summary: `Created department ${department.name}`,
        designations: [...titles.values()],
        actor: actorId ?? null,
      }),
    });
    return shape(department);
  }

  async findAll() {
    const rows = await this.prisma.department.findMany({ orderBy: { name: 'asc' }, include: INCLUDE });
    return rows.map(shape);
  }

  async findOne(id: string) {
    const department = await this.prisma.department.findUnique({ where: { id }, include: INCLUDE });
    if (!department) throw new NotFoundException('Department not found');
    return shape(department);
  }

  /** Active designations of one department, for the employee form's dropdown. */
  async findDesignations(id: string) {
    const department = await this.prisma.department.findUnique({ where: { id }, select: { id: true } });
    if (!department) throw new NotFoundException('Department not found');
    return this.prisma.designation.findMany({
      where: { status: 'ACTIVE', departments: { some: { departmentId: id } } },
      orderBy: { title: 'asc' },
      select: { id: true, title: true },
    });
  }

  async update(id: string, dto: UpdateDepartmentDto, actorId?: string) {
    const before = await this.findOne(id);
    const { designationIds, ...data } = dto;

    let added: string[] = [];
    let removed: string[] = [];
    let wanted: Set<string> | null = null;
    if (designationIds) {
      wanted = new Set(designationIds);
      await this.titlesOf([...wanted]);
      const current = new Map(before.designations.map((d) => [d.id, d.title]));
      added = [...wanted].filter((x) => !current.has(x));
      removed = [...current.keys()].filter((x) => !wanted!.has(x));
    }
    const titleOf = new Map<string, string>(before.designations.map((d) => [d.id, d.title]));
    if (added.length) for (const [k, v] of await this.titlesOf(added)) titleOf.set(k, v);

    // Unlinking never touches an employee who already holds the designation;
    // it only stops it being offered for new assignments.
    await this.prisma.$transaction(async (tx) => {
      await tx.department.update({ where: { id }, data });
      if (wanted) {
        if (removed.length) {
          await tx.departmentDesignation.deleteMany({ where: { departmentId: id, designationId: { in: removed } } });
        }
        if (added.length) {
          await tx.departmentDesignation.createMany({
            data: added.map((designationId) => ({ departmentId: id, designationId })),
            skipDuplicates: true,
          });
        }
      }
    });

    const updated = await this.findOne(id);
    await this.auditService.log({
      userId: actorId,
      action: 'DEPARTMENT_UPDATED',
      entity: 'Department',
      entityId: id,
      details: JSON.stringify({
        old: { name: before.name, code: before.code, status: before.status, designations: before.designations.map((d) => d.title) },
        new: { name: updated.name, code: updated.code, status: updated.status, designations: updated.designations.map((d) => d.title) },
        designationsAdded: added.map((x) => titleOf.get(x)),
        designationsRemoved: removed.map((x) => titleOf.get(x)),
        actor: actorId ?? null,
      }),
    });
    return updated;
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
