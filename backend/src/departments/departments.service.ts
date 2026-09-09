import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateDepartmentDto, CreateSubDepartmentRowInput, UpdateDepartmentDto } from './dto/department.dto';

@Injectable()
export class DepartmentsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /**
   * Creates a department and, when the "Add Department" popup's
   * Sub-Departments section had rows in it, every one of those
   * sub-departments -- all in a single transaction, so a failure partway
   * through (a duplicate name, a DB error) leaves nothing half-created.
   */
  async create(dto: CreateDepartmentDto, actorId?: string) {
    const existingCode = await this.prisma.department.findUnique({ where: { code: dto.code } });
    if (existingCode) throw new ConflictException('Department code already exists');

    const rows = (dto.subDepartments ?? []).filter((r) => r?.name?.trim());
    this.assertUniqueSubDepartmentNames(rows);

    const { subDepartments: _subDepartments, ...departmentData } = dto;

    const created = await this.prisma.$transaction(async (tx) => {
      const department = await tx.department.create({ data: departmentData });

      for (const row of rows) {
        const code = await this.generateSubDepartmentCode(tx, department.code, row.name);
        await tx.subDepartment.create({
          data: {
            departmentId: department.id,
            name: row.name.trim(),
            code,
            headEmployeeId: row.headEmployeeId || undefined,
          },
        });
      }

      return tx.department.findUniqueOrThrow({ where: { id: department.id }, include: this.includeRelations() });
    });

    await this.auditService.log({
      userId: actorId,
      action: 'DEPARTMENT_CREATED',
      entity: 'Department',
      entityId: created.id,
      details: rows.length
        ? `Created department ${created.name} with ${rows.length} sub-department(s): ${rows.map((r) => r.name.trim()).join(', ')}`
        : `Created department ${created.name}`,
    });
    return created;
  }

  findAll() {
    return this.prisma.department.findMany({
      orderBy: { name: 'asc' },
      include: this.includeRelations(),
    });
  }

  async findOne(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: this.includeRelations(),
    });
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  async update(id: string, dto: UpdateDepartmentDto, actorId?: string) {
    await this.findOne(id);
    const department = await this.prisma.department.update({
      where: { id },
      data: dto,
      include: this.includeRelations(),
    });
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

  private includeRelations() {
    return {
      manager: { select: { id: true, fullName: true } },
      subDepartments: {
        orderBy: { name: 'asc' as const },
        include: { manager: { select: { id: true, fullName: true } }, _count: { select: { employees: true } } },
      },
      _count: { select: { employees: true } },
    };
  }

  /**
   * Sub-department names only need to be unique within their own parent
   * (not globally -- "X-Ray" under Radiology and "X-Ray" under a future
   * second Radiology-like department would be fine), so this only checks
   * the rows submitted together in this one popup.
   */
  private assertUniqueSubDepartmentNames(rows: CreateSubDepartmentRowInput[]) {
    const seen = new Set<string>();
    for (const row of rows) {
      const key = row.name.trim().toLowerCase();
      if (seen.has(key)) {
        throw new ConflictException(`Sub-department name "${row.name.trim()}" is used more than once`);
      }
      seen.add(key);
    }
  }

  /**
   * Derives a sub-department code from the parent's code plus this name
   * (e.g. department code "RAD" + name "X-Ray" -> "RAD-XRAY"), retrying
   * with a numeric suffix on the rare collision. `code` is globally
   * unique in the schema even though the Add Department popup only asks
   * for a sub-department *name* -- this spares the user from inventing a
   * code for every row.
   */
  private async generateSubDepartmentCode(
    tx: Prisma.TransactionClient,
    departmentCode: string,
    name: string,
  ): Promise<string> {
    const slug = name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const base = `${departmentCode}-${slug || 'SUB'}`.slice(0, 40);

    let candidate = base;
    let suffix = 1;
    while (await tx.subDepartment.findUnique({ where: { code: candidate } })) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    return candidate;
  }
}
