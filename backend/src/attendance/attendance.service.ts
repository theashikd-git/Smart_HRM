import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { HolidaysService } from '../holidays/holidays.service';
import { PoliciesService } from '../policies/policies.service';
import { DayInput, DayResult, evaluateDay } from '../policies/policy-engine';
import { ZktecoClient, RawPunch } from '../devices/zkteco/zkteco-client.interface';
import { ZKTECO_CLIENT } from '../devices/zkteco/zkteco-client.token';
import {
  AttendanceQueryDto,
  ApproveAttendanceDto,
  CorrectAttendanceDto,
  ManualPunchDto,
} from './dto/attendance.dto';

const DAY_INDEX: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

@Injectable()
export class AttendanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AttendanceService.name);
  private syncTimer: NodeJS.Timeout | null = null;
  private isSyncing = false;

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private config: ConfigService,
    private holidaysService: HolidaysService,
    private policies: PoliciesService,
    @Inject(ZKTECO_CLIENT) private zkteco: ZktecoClient,
  ) {}

  onModuleInit() {
    const intervalMs = Number(this.config.get('ATTENDANCE_SYNC_INTERVAL_MS')) || 5 * 60_000;
    if (intervalMs <= 0) {
      this.logger.log('Automatic attendance sync disabled (ATTENDANCE_SYNC_INTERVAL_MS <= 0)');
      return;
    }
    this.syncTimer = setInterval(() => {
      this.syncFromDevice().catch((err) =>
        this.logger.error(`Scheduled attendance sync failed: ${err?.message ?? err}`),
      );
    }, intervalMs);
    this.syncTimer.unref?.();
    this.logger.log(`Automatic attendance sync scheduled every ${intervalMs}ms`);
  }

  onModuleDestroy() {
    if (this.syncTimer) clearInterval(this.syncTimer);
  }

  /**
   * Pull punches from the primary device and process them into records.
   * Runs on a schedule (see onModuleInit) as well as on-demand from the
   * "Sync now" button in the UI. Guarded against overlapping runs, and
   * retries the device pull once on transient failure before giving up.
   */
  async syncFromDevice(actorId?: string) {
    if (this.isSyncing) {
      return { pulled: 0, created: 0, message: 'A sync is already in progress' };
    }
    this.isSyncing = true;

    try {
      const device = await this.prisma.device.findFirst({ orderBy: { createdAt: 'asc' } });
      if (!device) {
        return { pulled: 0, created: 0, message: 'No device configured' };
      }

      let punches: RawPunch[];
      try {
        punches = await this.zkteco.getAttendanceLogs(device.ipAddress, device.port);
      } catch (err: any) {
        this.logger.warn(`Attendance pull from ${device.name} failed, retrying once: ${err.message}`);
        punches = await this.zkteco.getAttendanceLogs(device.ipAddress, device.port);
      }

      if (punches.length === 0) {
        await this.prisma.device.update({
          where: { id: device.id },
          data: { lastCommunication: new Date(), connectionStatus: 'ONLINE' },
        });
        return { pulled: 0, created: 0, affected: 0 };
      }

      // Batch-resolve employees instead of one findUnique() per punch.
      // Explicitly typed -- avoids an incremental-build TS inference gap
      // where this spread occasionally came back as `unknown[]` instead of
      // `string[]`, which the Prisma `in` filter below then rejected.
      const deviceUserIds: string[] = [...new Set(punches.map((p) => p.deviceUserId))];
      const employees = await this.prisma.employee.findMany({
        where: { deviceUserId: { in: deviceUserIds } },
      });
      const employeeByDeviceUserId = new Map(employees.map((e) => [e.deviceUserId as string, e]));

      // Batch-load existing logs across the whole pulled time range instead
      // of one findFirst() per punch, so duplicate detection is O(1) per
      // punch after a single query rather than N round trips to Postgres.
      const timestamps = punches.map((p) => p.timestamp.getTime());
      const rangeStart = new Date(Math.min(...timestamps));
      const rangeEnd = new Date(Math.max(...timestamps) + 1);
      const existingLogs = await this.prisma.attendanceLog.findMany({
        where: {
          employeeId: { in: employees.map((e) => e.id) },
          timestamp: { gte: rangeStart, lt: rangeEnd },
        },
        select: { employeeId: true, timestamp: true },
      });
      const existingKeys = new Set(existingLogs.map((l) => `${l.employeeId}|${l.timestamp.getTime()}`));

      const toCreate: {
        employeeId: string;
        deviceId: string;
        timestamp: Date;
        source: any;
        inOutMode: string | undefined;
      }[] = [];
      const affectedEmployeeDates = new Set<string>();
      let skippedUnknown = 0;

      for (const punch of punches) {
        const employee = employeeByDeviceUserId.get(punch.deviceUserId);
        if (!employee) {
          skippedUnknown++;
          continue; // unknown device user, skip
        }
        const key = `${employee.id}|${punch.timestamp.getTime()}`;
        if (existingKeys.has(key)) continue;
        existingKeys.add(key); // guard against dupes within this same pull

        toCreate.push({
          employeeId: employee.id,
          deviceId: device.id,
          timestamp: punch.timestamp,
          source: punch.verifyMode as any,
          inOutMode: punch.inOutMode,
        });
        affectedEmployeeDates.add(`${employee.id}|${startOfDay(punch.timestamp).toISOString()}`);
      }

      if (toCreate.length > 0) {
        // skipDuplicates relies on the (employeeId, timestamp) unique
        // constraint in schema.prisma -- a second safety net under the
        // in-memory de-dup above, in case another sync somehow ran
        // concurrently.
        await this.prisma.attendanceLog.createMany({ data: toCreate, skipDuplicates: true });
      }

      for (const key of affectedEmployeeDates) {
        const [employeeId, dateIso] = key.split('|');
        await this.processDay(employeeId, new Date(dateIso));
      }

      await this.prisma.device.update({
        where: { id: device.id },
        data: { lastCommunication: new Date(), connectionStatus: 'ONLINE' },
      });

      await this.auditService.log({
        userId: actorId,
        action: 'ATTENDANCE_DOWNLOADED',
        entity: 'Device',
        entityId: device.id,
        details: `Pulled ${punches.length} punches, ${toCreate.length} new${
          skippedUnknown ? `, ${skippedUnknown} from unrecognized device users` : ''
        }`,
      });

      return {
        pulled: punches.length,
        created: toCreate.length,
        affected: affectedEmployeeDates.size,
        skippedUnknown,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /** Manual punch entry (e.g. HR correcting a missed swipe). */
  async manualPunch(dto: ManualPunchDto, actorId?: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');

    const timestamp = new Date(dto.timestamp);
    try {
      await this.prisma.attendanceLog.create({
        data: {
          employeeId: employee.id,
          timestamp,
          source: 'MANUAL',
          inOutMode: dto.direction,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new NotFoundException(
          'A punch already exists for this employee at this exact timestamp',
        );
      }
      throw err;
    }

    const record = await this.processDay(employee.id, startOfDay(timestamp));

    await this.auditService.log({
      userId: actorId,
      action: 'ATTENDANCE_MANUAL_PUNCH',
      entity: 'AttendanceRecord',
      entityId: record?.id,
      details: `Manual ${dto.direction} for ${employee.fullName}`,
    });

    return record;
  }

  /** Recompute an employee's AttendanceRecord for a given day from raw logs. */
  private async processDay(employeeId: string, date: Date) {
    const dayStart = startOfDay(date);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const logs = await this.prisma.attendanceLog.findMany({
      where: { employeeId, timestamp: { gte: dayStart, lt: dayEnd } },
      orderBy: { timestamp: 'asc' },
    });

    if (logs.length === 0) return null;

    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { shift: true },
    });
    if (!employee) return null;

    const ins = logs.filter((l) => l.inOutMode === 'IN');
    const outs = logs.filter((l) => l.inOutMode === 'OUT');

    const checkIn = ins.length > 0 ? ins[0].timestamp : logs[0].timestamp;
    const checkOut = outs.length > 0 ? outs[outs.length - 1].timestamp : null;

    let earlyLeaveMinutes = 0;
    let overtimeMinutes = 0;
    let workHours: number | null = null;

    if (checkOut) {
      workHours = Math.round(((checkOut.getTime() - checkIn.getTime()) / 3600000) * 100) / 100;
    }

    // A flexible shift has no fixed end time, so no early-leave / overtime.
    if (employee.shift && employee.shift.shiftType !== 'FLEXIBLE' && checkOut) {
      const shiftEndMin = toMinutes(employee.shift.endTime);
      const checkOutMin = checkOut.getHours() * 60 + checkOut.getMinutes();
      if (checkOutMin < shiftEndMin) {
        earlyLeaveMinutes = shiftEndMin - checkOutMin;
      } else if (checkOutMin > shiftEndMin) {
        overtimeMinutes = checkOutMin - shiftEndMin;
      }
    }

    // Status (PRESENT / GRACE / LATE / HALF_DAY / HOLIDAY_DUTY / SHORT_HOURS)
    // and whether this arrival is tracked by an attendance policy.
    const { status, lateMinutes, occurrence } = await this.evaluate(employee, dayStart, checkIn, workHours);

    const record = await this.prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId, date: dayStart } },
      update: {
        checkIn,
        checkOut,
        workHours,
        lateMinutes,
        earlyLeaveMinutes,
        overtimeMinutes,
        status,
      },
      create: {
        employeeId,
        date: dayStart,
        checkIn,
        checkOut,
        workHours,
        lateMinutes,
        earlyLeaveMinutes,
        overtimeMinutes,
        status,
      },
    });

    // Keep the stored GRACE / LATE arrival (and any policy absent day it
    // completes) in step with this day. Repeatable: running it again for the
    // same day changes nothing.
    await this.policies.syncDay(employeeId, dayStart.toISOString().slice(0, 10), occurrence);

    return record;
  }

  /** Is the day a declared holiday, a weekly day off (roster OFF, or the shift's weekend), or a normal working day? */
  private async dayKind(
    employee: { id: string; shift: { weekendRule: string | null } | null },
    dayStart: Date,
  ): Promise<'WORKING' | 'HOLIDAY' | 'WEEKLY_OFF'> {
    if (await this.holidaysService.isHoliday(dayStart)) return 'HOLIDAY';

    const roster = await this.prisma.rosterAssignment.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date: dayStart } },
      select: { type: true, status: true },
    });
    if (roster && roster.status === 'APPROVED') return roster.type === 'OFF' ? 'WEEKLY_OFF' : 'WORKING';

    const rule = employee.shift?.weekendRule;
    if (rule) {
      for (const token of rule.split(',')) {
        const key = token.trim().slice(0, 3).toUpperCase();
        if (key in DAY_INDEX && DAY_INDEX[key] === dayStart.getDay()) return 'WEEKLY_OFF';
      }
    }
    return 'WORKING';
  }

  /** The day's status and policy occurrence for a check-in, applying every attendance rule. */
  private async evaluate(
    employee: {
      id: string;
      departmentId: string | null;
      designationId: string | null;
      policyExempt: boolean;
      policyExemptUntil: Date | null;
      shift: {
        shiftType: string;
        startTime: string;
        graceMinutes: number;
        requiredHours: any;
        weekendRule: string | null;
      } | null;
    },
    dayStart: Date,
    checkIn: Date,
    workHours: number | null,
  ): Promise<DayResult> {
    const [dayKind, leave, defs] = await Promise.all([
      this.dayKind(employee, dayStart),
      this.prisma.leaveRequest.findFirst({
        where: { employeeId: employee.id, status: 'APPROVED', startDate: { lte: dayStart }, endDate: { gte: dayStart } },
        select: { id: true },
      }),
      this.policies.loadDefs(),
    ]);

    const shift = employee.shift;
    const input: DayInput = {
      employee: this.policies.employeeCtx(employee),
      shift: shift
        ? {
            shiftType: shift.shiftType === 'FLEXIBLE' ? 'FLEXIBLE' : 'FIXED',
            startMin: toMinutes(shift.startTime),
            graceMin: shift.graceMinutes,
            requiredHours: shift.requiredHours === null || shift.requiredHours === undefined ? null : Number(shift.requiredHours),
          }
        : null,
      date: dayStart.toISOString().slice(0, 10),
      checkInMin: checkIn.getHours() * 60 + checkIn.getMinutes(),
      workHours,
      dayKind,
      onApprovedLeave: !!leave,
      policies: defs,
    };
    return evaluateDay(input);
  }

  /**
   * Re-runs the daily calculation from raw punches for every day since
   * `fromDate` (one employee, or everyone). This is the explicit "recalculate
   * from date" action: editing a policy never does it on its own. Days whose
   * record HR corrected by hand are left alone.
   */
  async recalculateFrom(fromDate: string, employeeId?: string, actorId?: string) {
    const from = startOfDay(new Date(fromDate));
    if (Number.isNaN(from.getTime())) throw new NotFoundException('Invalid date');

    const logs = await this.prisma.attendanceLog.findMany({
      where: { timestamp: { gte: from }, ...(employeeId ? { employeeId } : {}) },
      select: { employeeId: true, timestamp: true },
    });
    const corrected = await this.prisma.attendanceRecord.findMany({
      where: { date: { gte: from }, notes: { not: null }, ...(employeeId ? { employeeId } : {}) },
      select: { employeeId: true, date: true },
    });
    const skip = new Set(corrected.map((r) => `${r.employeeId}|${r.date.toISOString().slice(0, 10)}`));

    const days = new Map<string, { employeeId: string; day: Date }>();
    let skipped = 0;
    for (const l of logs) {
      const day = startOfDay(l.timestamp);
      const key = `${l.employeeId}|${day.toISOString().slice(0, 10)}`;
      if (days.has(key)) continue;
      if (skip.has(key)) {
        skipped++;
        days.set(key, { employeeId: '', day });
        continue;
      }
      days.set(key, { employeeId: l.employeeId, day });
    }

    let recalculated = 0;
    for (const { employeeId: id, day } of days.values()) {
      if (!id) continue;
      await this.processDay(id, day);
      recalculated++;
    }

    await this.policies.auditRecalculation(actorId, {
      fromDate: from.toISOString().slice(0, 10),
      employeeId: employeeId ?? null,
      recalculated,
      skippedCorrected: skipped,
    });
    return { fromDate: from.toISOString().slice(0, 10), recalculated, skippedCorrected: skipped };
  }

  async findAll(query: AttendanceQueryDto) {
    const page = query.page ? Math.max(parseInt(query.page, 10), 1) : 1;
    const pageSize = query.pageSize ? Math.max(parseInt(query.pageSize, 10), 1) : 25;

    const where: any = {};
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.status) where.status = query.status;
    if (query.departmentId) where.employee = { departmentId: query.departmentId };
    if (query.startDate || query.endDate) {
      where.date = {};
      if (query.startDate) where.date.gte = startOfDay(new Date(query.startDate));
      if (query.endDate) where.date.lte = startOfDay(new Date(query.endDate));
    }

    const [items, total] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              fullName: true,
              employeeCode: true,
              department: { select: { name: true } },
              shift: { select: { name: true, startTime: true, endTime: true } },
            },
          },
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.attendanceRecord.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: string) {
    const record = await this.prisma.attendanceRecord.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!record) throw new NotFoundException('Attendance record not found');
    return record;
  }

  async correct(id: string, dto: CorrectAttendanceDto, actorId?: string) {
    await this.findOne(id);
    const record = await this.prisma.attendanceRecord.update({
      where: { id },
      include: { employee: { include: { shift: true } } },
      data: {
        checkIn: dto.checkIn ? new Date(dto.checkIn) : undefined,
        checkOut: dto.checkOut ? new Date(dto.checkOut) : undefined,
        status: dto.status,
        notes: dto.notes,
      },
    });

    await this.auditService.log({
      userId: actorId,
      action: 'ATTENDANCE_CORRECTED',
      entity: 'AttendanceRecord',
      entityId: id,
      details: dto.notes,
    });

    // A correction changes the arrival the policies count. Marking the day
    // with any status other than LATE / GRACE excuses it; otherwise the
    // arrival is re-read from the (possibly corrected) check-in time.
    const excused = dto.status !== undefined && dto.status !== 'LATE' && dto.status !== 'GRACE';
    let occurrence: DayResult['occurrence'] = null;
    let key = record.date.toISOString().slice(0, 10);
    if (record.checkIn) {
      const dayStart = startOfDay(record.checkIn);
      key = dayStart.toISOString().slice(0, 10);
      if (!excused) {
        const workHours = record.workHours === null ? null : Number(record.workHours);
        occurrence = (await this.evaluate(record.employee, dayStart, record.checkIn, workHours)).occurrence;
      }
    }
    await this.policies.syncDay(record.employeeId, key, occurrence);

    return record;
  }

  async approve(id: string, dto: ApproveAttendanceDto, actorId?: string) {
    await this.findOne(id);
    const record = await this.prisma.attendanceRecord.update({
      where: { id },
      data: { approved: dto.approved },
    });

    await this.auditService.log({
      userId: actorId,
      action: dto.approved ? 'ATTENDANCE_APPROVED' : 'ATTENDANCE_UNAPPROVED',
      entity: 'AttendanceRecord',
      entityId: id,
    });

    return record;
  }

  /** Records with a check-in but no check-out — likely a missed swipe. */
  async missingPunches() {
    return this.prisma.attendanceRecord.findMany({
      where: { checkIn: { not: null }, checkOut: null },
      include: {
        employee: { select: { fullName: true, employeeCode: true } },
      },
      orderBy: { date: 'desc' },
      take: 100,
    });
  }
}
