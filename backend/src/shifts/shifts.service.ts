import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateShiftDto, UpdateShiftDto } from './dto/shift.dto';

const DEPARTMENT_SELECT = { select: { id: true, name: true } };

@Injectable()
export class ShiftsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /**
   * Which department id(s) this actor may create/manage shifts for.
   * - null  = unrestricted (ADMIN/HR/MANAGING_DIRECTOR/EMPLOYEE) -- sees and
   *   can touch every department's shifts, same as before this feature.
   * - []    = restricted but currently tied to no department at all (a
   *   MANAGER who heads no department, or a SUPERVISOR with no employee
   *   record / no department on it yet).
   * - [...] = restricted to exactly these department ids. A MANAGER is
   *   scoped to the department(s) where they're the configured head
   *   (Department.headEmployeeId -- the same rule already used for Roster
   *   approval and Leave tier resolution). A SUPERVISOR has no such
   *   "department I lead" concept in this app, so they're scoped to the
   *   department their own employee record belongs to instead.
   */
  private async resolveActorDepartmentIds(
    actorRole?: string,
    actorEmployeeId?: string | null,
  ): Promise<string[] | null> {
    if (actorRole !== 'MANAGER' && actorRole !== 'SUPERVISOR') return null;
    if (!actorEmployeeId) return [];

    if (actorRole === 'MANAGER') {
      const led = await this.prisma.department.findMany({
        where: { headEmployeeId: actorEmployeeId },
        select: { id: true },
      });
      return led.map((d) => d.id);
    }

    // SUPERVISOR
    const employee = await this.prisma.employee.findUnique({
      where: { id: actorEmployeeId },
      select: { departmentId: true },
    });
    return employee?.departmentId ? [employee.departmentId] : [];
  }

  async create(dto: CreateShiftDto, actorId?: string, actorRole?: string, actorEmployeeId?: string | null) {
    const allowed = await this.resolveActorDepartmentIds(actorRole, actorEmployeeId);
    let departmentId = dto.departmentId ?? null;

    if (allowed !== null) {
      if (allowed.length === 0) {
        throw new ForbiddenException(
          'You are not set up as the head or a member of any department yet, so you cannot create shifts. Ask HR/Admin to set this up first.',
        );
      }
      if (departmentId && !allowed.includes(departmentId)) {
        throw new ForbiddenException('You can only create shifts for your own department.');
      }
      // A restricted actor always lands in (one of) their own department(s) --
      // never leaves a Manager/Supervisor-created shift General by omission.
      departmentId = departmentId ?? allowed[0];
    }

    const shift = await this.prisma.shift.create({
      data: { ...dto, departmentId },
      include: { department: DEPARTMENT_SELECT },
    });
    await this.auditService.log({
      userId: actorId,
      action: 'SHIFT_CREATED',
      entity: 'Shift',
      entityId: shift.id,
    });
    return shift;
  }

  async findAll(actorRole?: string, actorEmployeeId?: string | null) {
    const allowed = await this.resolveActorDepartmentIds(actorRole, actorEmployeeId);
    const where = allowed === null ? {} : { OR: [{ departmentId: null }, { departmentId: { in: allowed } }] };

    return this.prisma.shift.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { _count: { select: { employees: true } }, department: DEPARTMENT_SELECT },
    });
  }

  async findOne(id: string) {
    const shift = await this.prisma.shift.findUnique({
      where: { id },
      include: { department: DEPARTMENT_SELECT },
    });
    if (!shift) throw new NotFoundException('Shift not found');
    return shift;
  }

  /** Throws if a restricted actor (MANAGER/SUPERVISOR) may not touch this
   *  shift -- either because it's outside their own department(s), or
   *  because it's a General (department-less) shift, which only HR/Admin
   *  may edit. Also blocks re-pointing it at someone else's department. */
  private assertCanManage(
    existing: { departmentId: string | null },
    allowed: string[] | null,
    nextDepartmentId: string | undefined,
  ) {
    if (allowed === null) return;
    if (!existing.departmentId || !allowed.includes(existing.departmentId)) {
      throw new ForbiddenException('You can only manage shifts in your own department.');
    }
    if (nextDepartmentId !== undefined && nextDepartmentId !== null && !allowed.includes(nextDepartmentId)) {
      throw new ForbiddenException('You can only assign shifts to your own department.');
    }
  }

  async update(id: string, dto: UpdateShiftDto, actorId?: string, actorRole?: string, actorEmployeeId?: string | null) {
    const existing = await this.findOne(id);
    const allowed = await this.resolveActorDepartmentIds(actorRole, actorEmployeeId);
    this.assertCanManage(existing, allowed, dto.departmentId);

    const shift = await this.prisma.shift.update({
      where: { id },
      data: dto,
      include: { department: DEPARTMENT_SELECT },
    });
    await this.auditService.log({
      userId: actorId,
      action: 'SHIFT_UPDATED',
      entity: 'Shift',
      entityId: id,
    });
    return shift;
  }

  async remove(id: string, actorId?: string, actorRole?: string, actorEmployeeId?: string | null) {
    const existing = await this.findOne(id);
    const allowed = await this.resolveActorDepartmentIds(actorRole, actorEmployeeId);
    this.assertCanManage(existing, allowed, undefined);

    await this.prisma.shift.delete({ where: { id } });
    await this.auditService.log({
      userId: actorId,
      action: 'SHIFT_DELETED',
      entity: 'Shift',
      entityId: id,
    });
    return { success: true };
  }
}
