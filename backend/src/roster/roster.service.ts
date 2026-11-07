import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ApproveRosterAssignmentDto,
  RemoveRosterAssignmentDto,
  RosterDayTypeDto,
  RosterQueryDto,
  UpsertRosterAssignmentDto,
} from './dto/roster.dto';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

const ASSIGNMENT_INCLUDE = {
  shift: { select: { id: true, name: true, startTime: true, endTime: true } },
  assignedBy: { select: { id: true, fullName: true, role: true } },
  approvedBy: { select: { id: true, fullName: true } },
};

@Injectable()
export class RosterService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Everything the Roster screen needs for one week (or any date range):
   * the employee list it should render rows for, the assignments already
   * made in that range (PENDING and APPROVED both -- this is the
   * Manager/HR management view, so it needs to show what's awaiting
   * approval too), and the real attendance already recorded in it --
   * kept as three flat lists (not pre-merged into a grid) so the frontend
   * can lay them out however the UI needs, same as how Attendance/Employee
   * pages already hand back flat lists rather than pre-built view models.
   */
  async getWeek(query: RosterQueryDto, actorRole?: string, actorEmployeeId?: string | null) {
    const start = startOfDay(new Date(query.startDate));
    const end = startOfDay(new Date(query.endDate));
    if (end < start) throw new BadRequestException('endDate must not be before startDate');

    // A MANAGER/SUPERVISOR only ever sees their own department's team here
    // -- the department filter in the query is ignored for them (there's
    // nothing else for them to pick from); ADMIN/HR/Managing Director keep
    // the full picker, same as before.
    const allowed = await this.resolveActorDepartmentIds(actorRole, actorEmployeeId);
    const employeeWhere: any = { status: 'ACTIVE' };
    if (allowed !== null) {
      employeeWhere.departmentId = { in: allowed };
    } else if (query.departmentId) {
      employeeWhere.departmentId = query.departmentId;
    }

    const employees = await this.prisma.employee.findMany({
      where: employeeWhere,
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        department: { select: { id: true, name: true } },
        designation: { select: { title: true } },
      },
      orderBy: { fullName: 'asc' },
    });

    const employeeIds = employees.map((e) => e.id);
    if (employeeIds.length === 0) {
      return { employees: [], assignments: [], attendance: [] };
    }

    const dateWhere = { employeeId: { in: employeeIds }, date: { gte: start, lte: end } };

    const [assignments, attendance] = await Promise.all([
      this.prisma.rosterAssignment.findMany({
        where: dateWhere,
        include: ASSIGNMENT_INCLUDE,
      }),
      this.prisma.attendanceRecord.findMany({
        where: dateWhere,
        select: { employeeId: true, date: true, status: true },
      }),
    ]);

    return { employees, assignments, attendance };
  }

  /**
   * The Employee Portal's "My Calendar" -- this employee's own planned
   * duties for a date range, no ADMIN/HR gate (any signed-in user can see
   * their own schedule). Only APPROVED assignments come back here: a
   * Manager's assignment that's still awaiting HR approval doesn't show
   * up on the employee's own dashboard yet, exactly like a leave request
   * doesn't count until it's approved. A login not linked to an Employee
   * record (a pure staff account) just gets nothing back instead of an
   * error.
   */
  async getMine(employeeId: string | null | undefined, query: RosterQueryDto) {
    if (!employeeId) return { assignments: [] };

    const start = startOfDay(new Date(query.startDate));
    const end = startOfDay(new Date(query.endDate));
    if (end < start) throw new BadRequestException('endDate must not be before startDate');

    const assignments = await this.prisma.rosterAssignment.findMany({
      where: { employeeId, date: { gte: start, lte: end }, status: 'APPROVED' },
      include: ASSIGNMENT_INCLUDE,
      orderBy: { date: 'asc' },
    });

    return { assignments };
  }

  private isHrOrAdmin(actorRole?: string) {
    return actorRole === 'ADMIN' || actorRole === 'HR';
  }

  /** Same resolution rule as ShiftsService: null = unrestricted (ADMIN/HR/
   *  Managing Director/EMPLOYEE); for a MANAGER, the department(s) they
   *  head (Department.headEmployeeId); for a SUPERVISOR, the single
   *  department their own employee record belongs to -- there's no
   *  "department I lead" concept for that role, so this is what "their
   *  department" means for Roster duty assignment too. */
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

    const employee = await this.prisma.employee.findUnique({
      where: { id: actorEmployeeId },
      select: { departmentId: true },
    });
    return employee?.departmentId ? [employee.departmentId] : [];
  }

  /** Small dashboard widget helper (Pending Approvals -- "Roster Changes"
   *  row): count of duties awaiting an HR/Admin decision -- a content
   *  change still PENDING, or a removal request on an otherwise-APPROVED
   *  row -- same idea as LeaveService.pendingCount(). */
  async pendingCount() {
    return this.prisma.rosterAssignment.count({
      where: { OR: [{ status: 'PENDING' }, { pendingRemoval: true }] },
    });
  }

  async upsert(
    employeeId: string,
    dateStr: string,
    dto: UpsertRosterAssignmentDto,
    actorId?: string,
    actorRole?: string,
    actorEmployeeId?: string | null,
  ) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, fullName: true, departmentId: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const allowed = await this.resolveActorDepartmentIds(actorRole, actorEmployeeId);
    if (allowed !== null && (!employee.departmentId || !allowed.includes(employee.departmentId))) {
      throw new ForbiddenException('You can only assign duty to employees in your own department.');
    }

    const date = startOfDay(new Date(dateStr));
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid date');

    let shiftId: string | null = null;
    if (dto.type === RosterDayTypeDto.SHIFT) {
      if (!dto.shiftId) throw new BadRequestException('shiftId is required when type is SHIFT');
      const shift = await this.prisma.shift.findUnique({ where: { id: dto.shiftId }, select: { id: true } });
      if (!shift) throw new NotFoundException('Shift not found');
      shiftId = dto.shiftId;
    }

    const hrOrAdmin = this.isHrOrAdmin(actorRole);
    const existing = await this.prisma.rosterAssignment.findUnique({ where: { employeeId_date: { employeeId, date } } });

    // Only a date that's already passed is gated now -- assigning or
    // changing today's or a future duty takes effect immediately for
    // anyone (Manager/Supervisor included), no reason and no HR approval
    // needed. A past date always needs a reason, and if it's not HR/Admin
    // making the change it goes PENDING for HR to confirm via approve().
    const isBackdate = date < startOfDay(new Date());
    if (isBackdate && !dto.hrNote?.trim()) {
      throw new BadRequestException('A reason is required to change a roster entry for a date that has already passed.');
    }
    const autoApproved = !isBackdate || hrOrAdmin;

    const updateData: Record<string, unknown> = {
      type: dto.type,
      shiftId,
      assignedById: actorId,
      hrNote: dto.hrNote,
      status: autoApproved ? 'APPROVED' : 'PENDING',
      approvedById: autoApproved ? actorId : null,
      approvedAt: autoApproved ? new Date() : null,
      // Picking new content always supersedes a pending removal request
      // on the same cell -- they're keeping the duty, not clearing it.
      pendingRemoval: false,
    };

    const assignment = await this.prisma.rosterAssignment.upsert({
      where: { employeeId_date: { employeeId, date } },
      create: {
        employeeId,
        date,
        type: dto.type,
        shiftId,
        assignedById: actorId,
        status: autoApproved ? 'APPROVED' : 'PENDING',
        approvedById: autoApproved ? actorId : null,
        approvedAt: autoApproved ? new Date() : null,
        hrNote: dto.hrNote,
      },
      update: updateData,
      include: ASSIGNMENT_INCLUDE,
    });

    const wasAlreadyApproved = existing?.status === 'APPROVED';
    const summary = dto.type === RosterDayTypeDto.OFF ? 'Set day off' : 'Assigned shift';

    await this.auditService.log({
      userId: actorId,
      action: wasAlreadyApproved ? 'ROSTER_CHANGED' : 'ROSTER_ASSIGNED',
      entity: 'RosterAssignment',
      entityId: assignment.id,
      details: `${summary} for ${employee.fullName} on ${dateStr} (${assignment.status})${dto.hrNote ? ` -- Note: ${dto.hrNote}` : ''}`,
    });

    // Only notify the employee once it's APPROVED -- a still-PENDING
    // assignment doesn't show on their dashboard yet, so telling them
    // about it now would be confusing (and they'd see it vanish/change
    // if HR edits it before approving).
    if (assignment.status === 'APPROVED') {
      await this.notificationsService.createForEmployee(
        employeeId,
        'SHIFT',
        wasAlreadyApproved ? 'Duty schedule changed' : 'Duty schedule updated',
        dto.type === RosterDayTypeDto.OFF
          ? `You've been scheduled off on ${dateStr}.`
          : `You've been assigned to ${assignment.shift?.name ?? 'a shift'} on ${dateStr}${assignment.shift ? ` (${assignment.shift.startTime}–${assignment.shift.endTime})` : ''}.`,
      );
    }

    return assignment;
  }

  /**
   * HR/Admin confirms a Manager's still-PENDING assignment. Only once this
   * runs does the assignment show up on the employee's own dashboard (see
   * getMine). A note is optional here -- nothing is being overridden, so
   * there's nothing that needs explaining yet.
   */
  async approve(employeeId: string, dateStr: string, dto: ApproveRosterAssignmentDto, actorId?: string) {
    const date = startOfDay(new Date(dateStr));
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid date');

    const existing = await this.prisma.rosterAssignment.findUnique({
      where: { employeeId_date: { employeeId, date } },
      include: { shift: { select: { name: true, startTime: true, endTime: true } } },
    });
    if (!existing) throw new NotFoundException('Roster assignment not found');

    // A removal request (see remove()) takes priority over whatever
    // status/content is on the row -- approving it here finishes the
    // removal instead of confirming the shift/day-off still on it.
    if (existing.pendingRemoval) {
      await this.prisma.rosterAssignment.deleteMany({ where: { employeeId, date } });
      await this.auditService.log({
        userId: actorId,
        action: 'ROSTER_REMOVAL_APPROVED',
        entity: 'RosterAssignment',
        entityId: existing.id,
        details: `Approved clearing roster assignment for ${dateStr}${dto.note ? ` -- Note: ${dto.note}` : ''}`,
      });
      if (existing.status === 'APPROVED') {
        await this.notificationsService.createForEmployee(
          employeeId,
          'SHIFT',
          'Duty schedule updated',
          `Your assigned duty on ${dateStr} was cleared.`,
        );
      }
      return { success: true };
    }

    if (existing.status !== 'PENDING') {
      throw new BadRequestException(`Only a pending duty can be approved (current status: ${existing.status}).`);
    }

    const assignment = await this.prisma.rosterAssignment.update({
      where: { employeeId_date: { employeeId, date } },
      data: { status: 'APPROVED', approvedById: actorId, approvedAt: new Date(), hrNote: dto.note },
      include: ASSIGNMENT_INCLUDE,
    });

    await this.auditService.log({
      userId: actorId,
      action: 'ROSTER_APPROVED',
      entity: 'RosterAssignment',
      entityId: assignment.id,
      details: `Approved duty on ${dateStr}${dto.note ? ` -- Note: ${dto.note}` : ''}`,
    });

    await this.notificationsService.createForEmployee(
      employeeId,
      'SHIFT',
      'Duty schedule updated',
      assignment.type === 'OFF'
        ? `You've been scheduled off on ${dateStr}.`
        : `You've been assigned to ${assignment.shift?.name ?? 'a shift'} on ${dateStr}${assignment.shift ? ` (${assignment.shift.startTime}–${assignment.shift.endTime})` : ''}.`,
    );

    return assignment;
  }

  async remove(
    employeeId: string,
    dateStr: string,
    dto: RemoveRosterAssignmentDto | undefined,
    actorId?: string,
    actorRole?: string,
    actorEmployeeId?: string | null,
  ) {
    const date = startOfDay(new Date(dateStr));
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid date');

    const allowed = await this.resolveActorDepartmentIds(actorRole, actorEmployeeId);
    if (allowed !== null) {
      const employee = await this.prisma.employee.findUnique({ where: { id: employeeId }, select: { departmentId: true } });
      if (!employee?.departmentId || !allowed.includes(employee.departmentId)) {
        throw new ForbiddenException('You can only manage duty for employees in your own department.');
      }
    }

    const existing = await this.prisma.rosterAssignment.findUnique({ where: { employeeId_date: { employeeId, date } } });
    if (!existing) return { success: true };

    // Same date-based gate as upsert(): a past date always needs a
    // reason. HR/Admin clears it right away; a MANAGER/SUPERVISOR instead
    // files a removal request -- the row (and its current content) stays
    // exactly as it was for the employee until HR/Admin approves it (see
    // approve()), which is when it's actually deleted.
    const hrOrAdmin = this.isHrOrAdmin(actorRole);
    const isBackdate = date < startOfDay(new Date());
    if (isBackdate && !dto?.hrNote?.trim()) {
      throw new BadRequestException('A reason is required to clear a roster entry for a date that has already passed.');
    }

    if (isBackdate && !hrOrAdmin) {
      const updated = await this.prisma.rosterAssignment.update({
        where: { employeeId_date: { employeeId, date } },
        data: { pendingRemoval: true, hrNote: dto?.hrNote, assignedById: actorId },
        include: ASSIGNMENT_INCLUDE,
      });
      await this.auditService.log({
        userId: actorId,
        action: 'ROSTER_REMOVAL_REQUESTED',
        entity: 'RosterAssignment',
        entityId: updated.id,
        details: `Requested clearing roster assignment for ${dateStr} -- Note: ${dto?.hrNote}`,
      });
      return updated;
    }

    const wasApproved = existing.status === 'APPROVED';
    await this.prisma.rosterAssignment.deleteMany({ where: { employeeId, date } });

    await this.auditService.log({
      userId: actorId,
      action: 'ROSTER_CLEARED',
      entity: 'RosterAssignment',
      entityId: `${employeeId}:${dateStr}`,
      details: `Cleared roster assignment for ${dateStr}${dto?.hrNote ? ` -- Note: ${dto.hrNote}` : ''}`,
    });

    // Only notify if the employee could actually see it before (a
    // still-PENDING assignment never showed on their dashboard, so
    // clearing it is a no-op from their point of view).
    if (wasApproved) {
      await this.notificationsService.createForEmployee(
        employeeId,
        'SHIFT',
        'Duty schedule updated',
        `Your assigned duty on ${dateStr} was cleared.`,
      );
    }

    return { success: true };
  }
}
