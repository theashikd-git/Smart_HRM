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
  async getWeek(query: RosterQueryDto) {
    const start = startOfDay(new Date(query.startDate));
    const end = startOfDay(new Date(query.endDate));
    if (end < start) throw new BadRequestException('endDate must not be before startDate');

    const employeeWhere: any = { status: 'ACTIVE' };
    if (query.departmentId) employeeWhere.departmentId = query.departmentId;

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

  /** Small dashboard widget helper (Pending Approvals -- "Roster Changes"
   *  row): count of duties awaiting an HR/Admin decision, same idea as
   *  LeaveService.pendingCount(). */
  async pendingCount() {
    return this.prisma.rosterAssignment.count({ where: { status: 'PENDING' } });
  }

  async upsert(employeeId: string, dateStr: string, dto: UpsertRosterAssignmentDto, actorId?: string, actorRole?: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, fullName: true } });
    if (!employee) throw new NotFoundException('Employee not found');

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

    // Once HR/Admin has approved an assignment, a Manager can no longer
    // touch it at all -- only HR/Admin can, and only with a note
    // explaining the change (see hrNote below).
    if (existing?.status === 'APPROVED' && !hrOrAdmin) {
      throw new ForbiddenException('This duty has already been approved by HR and can no longer be changed by a Manager.');
    }
    if (existing?.status === 'APPROVED' && hrOrAdmin && !dto.hrNote?.trim()) {
      throw new BadRequestException('A note is required to change a duty that has already been approved.');
    }

    // Re-assigning content on an existing assignment never changes its
    // status by itself -- a still-PENDING one stays PENDING (HR/Admin must
    // use the separate approve() action to confirm it), and an APPROVED
    // one stays APPROVED, just with the note recorded for why it changed.
    const updateData: Record<string, unknown> = { type: dto.type, shiftId, assignedById: actorId };
    if (existing?.status === 'APPROVED') {
      updateData.hrNote = dto.hrNote;
    }

    const assignment = await this.prisma.rosterAssignment.upsert({
      where: { employeeId_date: { employeeId, date } },
      create: {
        employeeId,
        date,
        type: dto.type,
        shiftId,
        assignedById: actorId,
        status: hrOrAdmin ? 'APPROVED' : 'PENDING',
        approvedById: hrOrAdmin ? actorId : null,
        approvedAt: hrOrAdmin ? new Date() : null,
        hrNote: hrOrAdmin ? dto.hrNote : undefined,
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

  async remove(employeeId: string, dateStr: string, dto: RemoveRosterAssignmentDto | undefined, actorId?: string, actorRole?: string) {
    const date = startOfDay(new Date(dateStr));
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid date');

    const existing = await this.prisma.rosterAssignment.findUnique({ where: { employeeId_date: { employeeId, date } } });
    if (!existing) return { success: true };

    const hrOrAdmin = this.isHrOrAdmin(actorRole);
    if (existing.status === 'APPROVED' && !hrOrAdmin) {
      throw new ForbiddenException('This duty has already been approved by HR and can no longer be changed by a Manager.');
    }
    if (existing.status === 'APPROVED' && hrOrAdmin && !dto?.hrNote?.trim()) {
      throw new BadRequestException('A note is required to clear a duty that has already been approved.');
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
