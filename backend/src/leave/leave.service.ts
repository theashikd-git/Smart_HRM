import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  AdjustLeaveBalanceDto,
  CreateLeaveRequestDto,
  InitializeBalancesDto,
  LeaveQueryDto,
  RejectLeaveRequestDto,
} from './dto/leave.dto';

const DAY_INDEX: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toNumber(decimal: any): number {
  return decimal === null || decimal === undefined ? 0 : Number(decimal);
}

@Injectable()
export class LeaveService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /**
   * Parses a Shift.weekendRule string (e.g. "Fri,Sat") into a set of
   * JS Date.getDay() indices. Unknown/empty input yields no weekly offs
   * rather than throwing, since this field is free-text and optional.
   */
  private parseWeekendDays(weekendRule?: string | null): Set<number> {
    const days = new Set<number>();
    if (!weekendRule) return days;
    for (const token of weekendRule.split(',')) {
      const key = token.trim().slice(0, 3).toUpperCase();
      if (key in DAY_INDEX) days.add(DAY_INDEX[key]);
    }
    return days;
  }

  /**
   * Counts leave days between startDate and endDate inclusive, skipping the
   * employee's weekly off days (from their assigned shift, if any). A
   * half-day session forces exactly one day (start === end) worth 0.5.
   */
  private calculateLeaveDays(
    startDate: Date,
    endDate: Date,
    session: 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF',
    weekendRule?: string | null,
  ): number {
    if (endDate.getTime() < startDate.getTime()) {
      throw new BadRequestException('endDate cannot be before startDate');
    }

    if (session !== 'FULL_DAY') {
      if (startDate.getTime() !== endDate.getTime()) {
        throw new BadRequestException('A half-day leave request must have the same start and end date');
      }
      return 0.5;
    }

    const weekendDays = this.parseWeekendDays(weekendRule);
    let count = 0;
    const cursor = new Date(startDate);
    while (cursor.getTime() <= endDate.getTime()) {
      if (!weekendDays.has(cursor.getDay())) count++;
      cursor.setDate(cursor.getDate() + 1);
    }
    // A leave request spanning only weekly-off days would otherwise charge
    // nothing yet still block/approve as if it were valid -- treat it as
    // at least the half/full single-day minimum so it isn't free.
    return count === 0 ? 1 : count;
  }

  // -------------------------------------------------------------------
  // Balances
  // -------------------------------------------------------------------

  async getBalances(employeeId: string, year?: number) {
    const targetYear = year ?? new Date().getFullYear();
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');

    const leaveTypes = await this.prisma.leaveType.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    const balances = await this.prisma.leaveBalance.findMany({
      where: { employeeId, year: targetYear },
    });
    const balanceByType = new Map(balances.map((b) => [b.leaveTypeId, b]));

    return leaveTypes.map((type) => {
      const balance = balanceByType.get(type.id);
      const allocated = toNumber(balance?.allocated);
      const carriedForward = toNumber(balance?.carriedForward);
      const used = toNumber(balance?.used);
      return {
        leaveTypeId: type.id,
        leaveTypeName: type.name,
        leaveTypeCode: type.code,
        color: type.color,
        paid: type.paid,
        year: targetYear,
        allocated,
        carriedForward,
        used,
        remaining: Math.round((allocated + carriedForward - used) * 10) / 10,
      };
    });
  }

  /** Fetches (or lazily creates, at 0 allocation) a balance row so approval
   *  bookkeeping always has somewhere to record `used` even for leave types
   *  nobody has explicitly allocated yet (e.g. unpaid leave). */
  private async ensureBalance(employeeId: string, leaveTypeId: string, year: number) {
    const existing = await this.prisma.leaveBalance.findUnique({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
    });
    if (existing) return existing;
    return this.prisma.leaveBalance.create({
      data: { employeeId, leaveTypeId, year, allocated: 0, carriedForward: 0, used: 0 },
    });
  }

  async adjustBalance(dto: AdjustLeaveBalanceDto, actorId?: string) {
    const year = dto.year ?? new Date().getFullYear();
    const employee = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');
    const leaveType = await this.prisma.leaveType.findUnique({ where: { id: dto.leaveTypeId } });
    if (!leaveType) throw new NotFoundException('Leave type not found');

    const balance = await this.prisma.leaveBalance.upsert({
      where: { employeeId_leaveTypeId_year: { employeeId: dto.employeeId, leaveTypeId: dto.leaveTypeId, year } },
      update: {
        allocated: dto.allocated ?? undefined,
        carriedForward: dto.carriedForward ?? undefined,
      },
      create: {
        employeeId: dto.employeeId,
        leaveTypeId: dto.leaveTypeId,
        year,
        allocated: dto.allocated ?? 0,
        carriedForward: dto.carriedForward ?? 0,
        used: 0,
      },
    });

    await this.auditService.log({
      userId: actorId,
      action: 'LEAVE_BALANCE_ADJUSTED',
      entity: 'LeaveBalance',
      entityId: balance.id,
      details: `${employee.fullName} / ${leaveType.name} (${year})${dto.note ? `: ${dto.note}` : ''}`,
    });

    return balance;
  }

  /**
   * Creates a balance row (at the leave type's default annual entitlement)
   * for every active employee x active leave type combination that doesn't
   * already have one for the given year. Safe to re-run -- existing rows
   * are left untouched. Entitlements are NOT prorated by joining date in
   * this pass; adjust individual balances via adjustBalance() for
   * mid-year hires if you need that.
   */
  async initializeBalances(dto: InitializeBalancesDto, actorId?: string) {
    const year = dto.year ?? new Date().getFullYear();
    const leaveTypes = await this.prisma.leaveType.findMany({
      where: { isActive: true, ...(dto.leaveTypeId ? { id: dto.leaveTypeId } : {}) },
    });
    const employees = await this.prisma.employee.findMany({ where: { status: 'ACTIVE' } });

    let created = 0;
    for (const employee of employees) {
      for (const type of leaveTypes) {
        const existing = await this.prisma.leaveBalance.findUnique({
          where: { employeeId_leaveTypeId_year: { employeeId: employee.id, leaveTypeId: type.id, year } },
        });
        if (existing) continue;
        await this.prisma.leaveBalance.create({
          data: {
            employeeId: employee.id,
            leaveTypeId: type.id,
            year,
            allocated: type.daysPerYear,
            carriedForward: 0,
            used: 0,
          },
        });
        created++;
      }
    }

    await this.auditService.log({
      userId: actorId,
      action: 'LEAVE_BALANCES_INITIALIZED',
      entity: 'LeaveBalance',
      details: `Created ${created} balance record(s) for ${year}`,
    });

    return { year, employeesConsidered: employees.length, leaveTypesConsidered: leaveTypes.length, created };
  }

  // -------------------------------------------------------------------
  // Requests
  // -------------------------------------------------------------------

  async create(dto: CreateLeaveRequestDto, actorId?: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
      include: { shift: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const leaveType = await this.prisma.leaveType.findUnique({ where: { id: dto.leaveTypeId } });
    if (!leaveType) throw new NotFoundException('Leave type not found');
    if (!leaveType.isActive) throw new BadRequestException('This leave type is no longer active');

    const startDate = startOfDay(new Date(dto.startDate));
    const endDate = startOfDay(new Date(dto.endDate));
    const session = dto.session ?? 'FULL_DAY';
    const totalDays = this.calculateLeaveDays(startDate, endDate, session as any, employee.shift?.weekendRule);

    // Overlap guard: no two PENDING/APPROVED requests for the same employee
    // may cover the same date.
    const overlapping = await this.prisma.leaveRequest.findFirst({
      where: {
        employeeId: dto.employeeId,
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });
    if (overlapping) {
      throw new ConflictException('This employee already has a leave request covering part of this date range');
    }

    const year = startDate.getFullYear();
    if (!dto.overrideBalance) {
      const balance = await this.ensureBalance(dto.employeeId, dto.leaveTypeId, year);
      const remaining =
        toNumber(balance.allocated) + toNumber(balance.carriedForward) - toNumber(balance.used);
      if (totalDays > remaining) {
        throw new BadRequestException(
          `${employee.fullName} only has ${remaining} day(s) of ${leaveType.name} remaining for ${year} ` +
            `(requested ${totalDays}). Pass overrideBalance: true to approve anyway.`,
        );
      }
    }

    const request = await this.prisma.leaveRequest.create({
      data: {
        employeeId: dto.employeeId,
        leaveTypeId: dto.leaveTypeId,
        startDate,
        endDate,
        session: session as any,
        totalDays,
        reason: dto.reason,
        appliedById: actorId,
        status: leaveType.requiresApproval ? 'PENDING' : 'APPROVED',
        ...(leaveType.requiresApproval ? {} : { decidedById: actorId, decidedAt: new Date() }),
      },
      include: this.includeRelations(),
    });

    await this.auditService.log({
      userId: actorId,
      action: 'LEAVE_REQUESTED',
      entity: 'LeaveRequest',
      entityId: request.id,
      details: `${employee.fullName}: ${leaveType.name}, ${totalDays} day(s) from ${dto.startDate} to ${dto.endDate}`,
    });

    // Leave types that don't require approval are auto-approved above --
    // apply the same balance/attendance side effects immediately.
    if (request.status === 'APPROVED') {
      await this.applyApprovalSideEffects(request);
    }

    return request;
  }

  private includeRelations() {
    return {
      employee: {
        select: {
          id: true,
          fullName: true,
          employeeCode: true,
          department: { select: { name: true } },
          shift: { select: { weekendRule: true } },
        },
      },
      leaveType: { select: { id: true, name: true, code: true, color: true, paid: true } },
      appliedBy: { select: { id: true, fullName: true } },
      decidedBy: { select: { id: true, fullName: true } },
    };
  }

  async findAll(query: LeaveQueryDto) {
    const page = query.page ? Math.max(parseInt(query.page, 10), 1) : 1;
    const pageSize = query.pageSize ? Math.max(parseInt(query.pageSize, 10), 1) : 25;

    const where: any = {};
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.leaveTypeId) where.leaveTypeId = query.leaveTypeId;
    if (query.status) where.status = query.status;
    if (query.departmentId) where.employee = { departmentId: query.departmentId };
    if (query.startDate || query.endDate) {
      where.AND = [
        query.startDate ? { endDate: { gte: startOfDay(new Date(query.startDate)) } } : {},
        query.endDate ? { startDate: { lte: startOfDay(new Date(query.endDate)) } } : {},
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where,
        include: this.includeRelations(),
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: string) {
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: this.includeRelations(),
    });
    if (!request) throw new NotFoundException('Leave request not found');
    return request;
  }

  /** Deducts the balance and marks each covered day ON_LEAVE in attendance.
   *  Shared by explicit approve() and by create() for no-approval-needed
   *  leave types. */
  private async applyApprovalSideEffects(request: {
    id: string;
    employeeId: string;
    leaveTypeId: string;
    startDate: Date;
    endDate: Date;
    totalDays: any;
  }) {
    const year = request.startDate.getFullYear();
    const balance = await this.ensureBalance(request.employeeId, request.leaveTypeId, year);
    await this.prisma.leaveBalance.update({
      where: { id: balance.id },
      data: { used: toNumber(balance.used) + toNumber(request.totalDays) },
    });

    // Mark each covered calendar day ON_LEAVE in attendance, so reports
    // don't show these as unexplained absences. Only touches days that
    // don't already have a real punch-based record (checkIn is null) --
    // if the employee somehow already punched in that day, leave whatever
    // attendance sync produced alone rather than overwrite it.
    const cursor = new Date(request.startDate);
    while (cursor.getTime() <= request.endDate.getTime()) {
      const day = startOfDay(cursor);
      await this.prisma.attendanceRecord.upsert({
        where: { employeeId_date: { employeeId: request.employeeId, date: day } },
        update: {}, // no-op if a real record already exists for this day
        create: {
          employeeId: request.employeeId,
          date: day,
          status: 'ON_LEAVE',
          approved: true,
        },
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  /** Reverses applyApprovalSideEffects() -- used when cancelling an
   *  already-approved request. */
  private async reverseApprovalSideEffects(request: {
    id: string;
    employeeId: string;
    leaveTypeId: string;
    startDate: Date;
    endDate: Date;
    totalDays: any;
  }) {
    const year = request.startDate.getFullYear();
    const balance = await this.ensureBalance(request.employeeId, request.leaveTypeId, year);
    await this.prisma.leaveBalance.update({
      where: { id: balance.id },
      data: { used: Math.max(0, toNumber(balance.used) - toNumber(request.totalDays)) },
    });

    // Only remove the ON_LEAVE placeholder rows this module created (no
    // checkIn/checkOut) -- never touch a day that has real punch data.
    await this.prisma.attendanceRecord.deleteMany({
      where: {
        employeeId: request.employeeId,
        date: { gte: request.startDate, lte: request.endDate },
        status: 'ON_LEAVE',
        checkIn: null,
        checkOut: null,
      },
    });
  }

  async approve(id: string, actorId?: string) {
    const request = await this.findOne(id);
    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Only PENDING requests can be approved (current status: ${request.status})`);
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: { status: 'APPROVED', decidedById: actorId, decidedAt: new Date() },
      include: this.includeRelations(),
    });

    await this.applyApprovalSideEffects(updated);

    await this.auditService.log({
      userId: actorId,
      action: 'LEAVE_APPROVED',
      entity: 'LeaveRequest',
      entityId: id,
      details: `${updated.employee.fullName}: ${updated.leaveType.name}, ${updated.totalDays} day(s)`,
    });

    return updated;
  }

  async reject(id: string, dto: RejectLeaveRequestDto, actorId?: string) {
    const request = await this.findOne(id);
    if (request.status !== 'PENDING') {
      throw new BadRequestException(`Only PENDING requests can be rejected (current status: ${request.status})`);
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        decidedById: actorId,
        decidedAt: new Date(),
        rejectionReason: dto.reason,
      },
      include: this.includeRelations(),
    });

    await this.auditService.log({
      userId: actorId,
      action: 'LEAVE_REJECTED',
      entity: 'LeaveRequest',
      entityId: id,
      details: dto.reason,
    });

    return updated;
  }

  async cancel(id: string, actorId?: string) {
    const request = await this.findOne(id);
    if (request.status !== 'PENDING' && request.status !== 'APPROVED') {
      throw new BadRequestException(`Cannot cancel a request that is already ${request.status}`);
    }

    if (request.status === 'APPROVED') {
      await this.reverseApprovalSideEffects(request);
    }

    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
      include: this.includeRelations(),
    });

    await this.auditService.log({
      userId: actorId,
      action: 'LEAVE_CANCELLED',
      entity: 'LeaveRequest',
      entityId: id,
    });

    return updated;
  }

  /** Small dashboard widget helper: count of requests awaiting a decision. */
  async pendingCount() {
    return this.prisma.leaveRequest.count({ where: { status: 'PENDING' } });
  }

  /** Leaves covering any part of [from, to] -- for a leave calendar view. */
  async calendar(from: string, to: string, departmentId?: string) {
    const rangeStart = startOfDay(new Date(from));
    const rangeEnd = startOfDay(new Date(to));
    return this.prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: rangeEnd },
        endDate: { gte: rangeStart },
        ...(departmentId ? { employee: { departmentId } } : {}),
      },
      include: this.includeRelations(),
      orderBy: { startDate: 'asc' },
    });
  }
}
