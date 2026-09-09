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
    const code = dto.code?.trim() || (await this.generateCode(dto.departmentId, dto.name));

    const existing = await this.prisma.subDepartment.findUnique({ where: { code } });
    if (existing) throw new ConflictException('Sub-department code already exists');

    const subDepartment = await this.prisma.subDepartment.create({ data: { ...dto, code } });
    await this.auditService.log({
      userId: actorId,
      action: 'SUB_DEPARTMENT_CREATED',
      entity: 'SubDepartment',
      entityId: subDepartment.id,
      details: `Created sub-department ${subDepartment.name}`,
    });
    return subDepartment;
  }

  /**
   * Derives a sub-department code from its parent department's code plus
   * the sub-department's own name (e.g. department "RAD" + name "X-Ray" ->
   * "RAD-XRAY"), retrying with a numeric suffix on the rare collision.
   * `code` is globally unique in the schema even though sub-department
   * *names* only need to be unique within their parent, so this exists to
   * spare the user from having to invent a code for every row in the Add
   * Department popup.
   */
  private async generateCode(departmentId: string, name: string): Promise<string> {
    const department = await this.prisma.department.findUnique({ where: { id: departmentId } });
    const prefix = department?.code || 'SUB';
    const slug = name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const base = `${prefix}-${slug || 'SUB'}`.slice(0, 40);

    let candidate = base;
    let suffix = 1;
    while (await this.prisma.subDepartment.findUnique({ where: { code: candidate } })) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }
    return candidate;
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
