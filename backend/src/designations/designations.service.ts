import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateDesignationDto, UpdateDesignationDto } from './dto/designation.dto';

// What every designation response carries: how many employees hold it and
// which departments list it.
const INCLUDE = {
  _count: { select: { employees: true } },
  departments: {
    select: { department: { select: { id: true, name: true } } },
    orderBy: { department: { name: 'asc' } },
  },
} satisfies Prisma.DesignationInclude;

type DesignationRow = Prisma.DesignationGetPayload<{ include: typeof INCLUDE }>;

/** Flattens the join rows into `departments: [{ id, name }]`. */
function shape(row: DesignationRow) {
  const { departments, ...rest } = row;
  return { ...rest, departments: departments.map((d) => d.department) };
}

@Injectable()
export class DesignationsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /** Titles are unique ignoring case and surrounding spaces. */
  private async assertTitleFree(title: string, exceptId?: string) {
    const clash = await this.prisma.designation.findFirst({
      where: { title: { equals: title, mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { title: true },
    });
    if (clash) throw new ConflictException(`A designation named "${clash.title}" already exists`);
  }

  async create(dto: CreateDesignationDto, actorId?: string) {
    const title = dto.title.trim();
    if (!title) throw new BadRequestException('Designation title is required');
    await this.assertTitleFree(title);

    const designation = await this.prisma.designation.create({
      data: { title, status: dto.status },
      include: INCLUDE,
    });
    await this.auditService.log({
      userId: actorId,
      action: 'DESIGNATION_CREATED',
      entity: 'Designation',
      entityId: designation.id,
      details: JSON.stringify({ new: { title: designation.title, status: designation.status }, actor: actorId ?? null }),
    });
    return shape(designation);
  }

  async findAll() {
    const rows = await this.prisma.designation.findMany({ orderBy: { title: 'asc' }, include: INCLUDE });
    return rows.map(shape);
  }

  async findOne(id: string) {
    const designation = await this.prisma.designation.findUnique({ where: { id }, include: INCLUDE });
    if (!designation) throw new NotFoundException('Designation not found');
    return shape(designation);
  }

  async update(id: string, dto: UpdateDesignationDto, actorId?: string) {
    const before = await this.findOne(id);
    const title = dto.title !== undefined ? dto.title.trim() : undefined;
    if (title !== undefined) {
      if (!title) throw new BadRequestException('Designation title is required');
      await this.assertTitleFree(title, id);
    }

    const designation = await this.prisma.designation.update({
      where: { id },
      data: { title, status: dto.status },
      include: INCLUDE,
    });
    await this.auditService.log({
      userId: actorId,
      action: 'DESIGNATION_UPDATED',
      entity: 'Designation',
      entityId: id,
      details: JSON.stringify({
        old: { title: before.title, status: before.status },
        new: { title: designation.title, status: designation.status },
        actor: actorId ?? null,
      }),
    });
    return shape(designation);
  }

  async remove(id: string, actorId?: string) {
    const designation = await this.findOne(id);
    const inUse = designation._count.employees;
    if (inUse > 0) {
      throw new ConflictException(
        `"${designation.title}" is held by ${inUse} employee${inUse === 1 ? '' : 's'}, so it can't be deleted. Set it to Inactive instead.`,
      );
    }
    // Its links to departments go with it (cascade).
    await this.prisma.designation.delete({ where: { id } });
    await this.auditService.log({
      userId: actorId,
      action: 'DESIGNATION_DELETED',
      entity: 'Designation',
      entityId: id,
      details: JSON.stringify({
        old: { title: designation.title, status: designation.status, departments: designation.departments.map((d) => d.name) },
        actor: actorId ?? null,
      }),
    });
    return { success: true };
  }
}
