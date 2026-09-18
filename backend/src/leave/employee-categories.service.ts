import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateEmployeeCategoryDto, UpdateEmployeeCategoryDto } from './dto/employee-category.dto';

/**
 * HR-configurable employee-type categories (Permanent, Provision,
 * Contractual, Trial by default -- HR can rename these or add more). What
 * Employee.leaveCategoryId and LeaveCategoryPolicy.leaveCategoryId point at.
 * LeaveSchedulerService reads accruesRollover/hasFixedPeriod off these
 * instead of hardcoding category names, so a brand-new category picks up
 * the right scheduled behavior automatically.
 */
@Injectable()
export class EmployeeCategoriesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(dto: CreateEmployeeCategoryDto, actorId?: string) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Category name is required');

    const existing = await this.prisma.employeeCategory.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) throw new ConflictException(`An employee category named "${name}" already exists`);

    const hasFixedPeriod = dto.hasFixedPeriod ?? false;
    const code = await this.generateCode(name);
    const category = await this.prisma.employeeCategory.create({
      data: {
        name,
        code,
        accruesRollover: dto.accruesRollover ?? true,
        hasFixedPeriod,
        defaultPeriodMonths: hasFixedPeriod ? dto.defaultPeriodMonths : undefined,
      },
    });

    await this.auditService.log({
      userId: actorId,
      action: 'EMPLOYEE_CATEGORY_CREATED',
      entity: 'EmployeeCategory',
      entityId: category.id,
      details: `Created employee category "${name}"`,
    });

    return category;
  }

  findAll(includeInactive = false) {
    return this.prisma.employeeCategory.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.employeeCategory.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Employee category not found');
    return category;
  }

  async update(id: string, dto: UpdateEmployeeCategoryDto, actorId?: string) {
    const category = await this.findOne(id);

    let name = category.name;
    if (dto.name !== undefined) {
      name = dto.name.trim();
      if (!name) throw new BadRequestException('Category name is required');
      if (name.toLowerCase() !== category.name.toLowerCase()) {
        const clash = await this.prisma.employeeCategory.findFirst({
          where: { id: { not: id }, name: { equals: name, mode: 'insensitive' } },
        });
        if (clash) throw new ConflictException(`An employee category named "${name}" already exists`);
      }
    }

    const hasFixedPeriod = dto.hasFixedPeriod ?? category.hasFixedPeriod;
    const updated = await this.prisma.employeeCategory.update({
      where: { id },
      data: {
        name,
        accruesRollover: dto.accruesRollover ?? category.accruesRollover,
        hasFixedPeriod,
        defaultPeriodMonths: hasFixedPeriod ? (dto.defaultPeriodMonths ?? category.defaultPeriodMonths) : null,
      },
    });

    await this.auditService.log({
      userId: actorId,
      action: 'EMPLOYEE_CATEGORY_UPDATED',
      entity: 'EmployeeCategory',
      entityId: id,
    });

    return updated;
  }

  /**
   * Soft-delete only: employees may still reference this category (its FK
   * is ON DELETE SET NULL, which would silently strip their category), and
   * any LeaveCategoryPolicy row referencing it blocks a hard delete outright
   * (ON DELETE RESTRICT). Deactivating hides it from new picks while
   * leaving existing employees/policies untouched.
   */
  async remove(id: string, actorId?: string) {
    await this.findOne(id);
    const category = await this.prisma.employeeCategory.update({ where: { id }, data: { isActive: false } });
    await this.auditService.log({
      userId: actorId,
      action: 'EMPLOYEE_CATEGORY_DEACTIVATED',
      entity: 'EmployeeCategory',
      entityId: id,
    });
    return category;
  }

  // Slugifies a category name into an uppercase, underscore-separated code
  // and de-duplicates it against the unique `code` column by appending a
  // numeric suffix -- e.g. "Night Shift" -> NIGHT_SHIFT, and again ->
  // NIGHT_SHIFT_2.
  private async generateCode(name: string): Promise<string> {
    const base =
      name
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 30) || 'CATEGORY';

    let code = base;
    let suffix = 1;
    while (await this.prisma.employeeCategory.findUnique({ where: { code } })) {
      suffix++;
      code = `${base}_${suffix}`;
    }
    return code;
  }
}
