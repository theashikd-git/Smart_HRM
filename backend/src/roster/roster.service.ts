import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RosterQueryDto, UpsertRosterAssignmentDto, RosterDayTypeDto } from './dto/roster.dto';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

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
   * made in that range, and the real attendance already recorded in it --
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
        subDepartment: { select: { id: true, name: true } },
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
        include: { shift: { select: { id: true, name: true, startTime: true, endTime: true } } },
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
   * their own schedule). A login not linked to an Employee record (a pure
   * staff account) just gets nothing back instead of an error.
   */
  async getMine(employeeId: string | null | undefined, query: RosterQueryDto) {
    if (!employeeId) return { assignments: [] };

    const start = startOfDay(new Date(query.startDate));
    const end = startOfDay(new Date(query.endDate));
    if (end < start) throw new BadRequestException('endDate must not be before startDate');

    const assignments = await this.prisma.rosterAssignment.findMany({
      where: { employeeId, date: { gte: start, lte: end } },
      include: { shift: { select: { id: true, name: true, startTime: true, endTime: true } } },
      orderBy: { date: 'asc' },
    });

    return { assignments };
  }

  async upsert(employeeId: string, dateStr: string, dto: UpsertRosterAssignmentDto, actorId?: string) {
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

    const assignment = await this.prisma.rosterAssignment.upsert({
      where: { employeeId_date: { employeeId, date } },
      create: { employeeId, date, type: dto.type, shiftId },
      update: { type: dto.type, shiftId },
      include: { shift: { select: { id: true, name: true, startTime: true, endTime: true } } },
    });

    await this.auditService.log({
      userId: actorId,
      action: 'ROSTER_ASSIGNED',
      entity: 'RosterAssignment',
      entityId: assignment.id,
      details: `${dto.type === RosterDayTypeDto.OFF ? 'Set day off' : 'Assigned shift'} for ${employee.fullName} on ${dateStr}`,
    });

    await this.notificationsService.create(
      employeeId,
      'SHIFT',
      'Duty schedule updated',
      dto.type === RosterDayTypeDto.OFF
        ? `You've been scheduled off on ${dateStr}.`
        : `You've been assigned to ${assignment.shift?.name ?? 'a shift'} on ${dateStr}${assignment.shift ? ` (${assignment.shift.startTime}–${assignment.shift.endTime})` : ''}.`,
    );

    return assignment;
  }

  async remove(employeeId: string, dateStr: string, actorId?: string) {
    const date = startOfDay(new Date(dateStr));
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Invalid date');

    const { count } = await this.prisma.rosterAssignment.deleteMany({ where: { employeeId, date } });
    if (count === 0) return { success: true };

    await this.auditService.log({
      userId: actorId,
      action: 'ROSTER_CLEARED',
      entity: 'RosterAssignment',
      entityId: `${employeeId}:${dateStr}`,
      details: `Cleared roster assignment for ${dateStr}`,
    });

    await this.notificationsService.create(
      employeeId,
      'SHIFT',
      'Duty schedule updated',
      `Your assigned duty on ${dateStr} was cleared.`,
    );

    return { success: true };
  }
}
