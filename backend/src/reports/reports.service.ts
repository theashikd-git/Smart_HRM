import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

const DAY_INDEX: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

/** Shift.weekendRule ("Fri,Sat") -> JS Date.getDay() indices. */
function weekendDays(rule?: string | null): Set<number> {
  const days = new Set<number>();
  if (!rule) return days;
  for (const token of rule.split(',')) {
    const key = token.trim().slice(0, 3).toUpperCase();
    if (key in DAY_INDEX) days.add(DAY_INDEX[key]);
  }
  return days;
}

export type AttendanceDetailType = 'late' | 'absent' | 'overtime' | 'present' | 'early-out' | 'missing-punch';

export interface AttendanceDetailFilters {
  type: AttendanceDetailType;
  startDate?: string;
  endDate?: string;
  departmentId?: string;
  employeeId?: string;
  shiftId?: string;
}

function toCsv(rows: Record<string, any>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = String(val instanceof Date ? val.toISOString() : val);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(','));
  }
  return lines.join('\n');
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  private dateRange(startDate?: string, endDate?: string) {
    const where: any = {};
    if (startDate || endDate) {
      where.gte = startDate ? startOfDay(new Date(startDate)) : undefined;
      where.lte = endDate ? startOfDay(new Date(endDate)) : undefined;
    }
    return Object.keys(where).length ? where : undefined;
  }

  async dailyAttendance(date?: string) {
    const day = startOfDay(date ? new Date(date) : new Date());
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);

    return this.prisma.attendanceRecord.findMany({
      where: { date: { gte: day, lt: nextDay } },
      include: {
        employee: {
          select: { fullName: true, employeeCode: true, department: { select: { name: true } } },
        },
      },
      orderBy: { checkIn: 'asc' },
    });
  }

  async monthlyAttendance(month?: string) {
    const target = month ? new Date(`${month}-01`) : new Date();
    const monthStart = new Date(target.getFullYear(), target.getMonth(), 1);
    const monthEnd = new Date(target.getFullYear(), target.getMonth() + 1, 1);

    return this.prisma.attendanceRecord.findMany({
      where: { date: { gte: monthStart, lt: monthEnd } },
      include: {
        employee: {
          select: { fullName: true, employeeCode: true, department: { select: { name: true } } },
        },
      },
      orderBy: [{ employeeId: 'asc' }, { date: 'asc' }],
    });
  }

  async employeeAttendance(employeeId: string, startDate?: string, endDate?: string) {
    return this.prisma.attendanceRecord.findMany({
      where: { employeeId, date: this.dateRange(startDate, endDate) },
      orderBy: { date: 'desc' },
    });
  }

  async lateReport(startDate?: string, endDate?: string) {
    return this.prisma.attendanceRecord.findMany({
      where: { status: 'LATE', date: this.dateRange(startDate, endDate) },
      include: {
        employee: {
          select: { fullName: true, employeeCode: true, department: { select: { name: true } } },
        },
      },
      orderBy: { lateMinutes: 'desc' },
    });
  }

  async overtimeReport(startDate?: string, endDate?: string) {
    return this.prisma.attendanceRecord.findMany({
      where: { overtimeMinutes: { gt: 0 }, date: this.dateRange(startDate, endDate) },
      include: {
        employee: {
          select: { fullName: true, employeeCode: true, department: { select: { name: true } } },
        },
      },
      orderBy: { overtimeMinutes: 'desc' },
    });
  }

  async departmentAttendanceReport(startDate?: string, endDate?: string) {
    const departments = await this.prisma.department.findMany();
    const results: { department: string; presentCount: number; lateCount: number }[] = [];
    for (const dept of departments) {
      const records = await this.prisma.attendanceRecord.count({
        where: {
          employee: { departmentId: dept.id },
          date: this.dateRange(startDate, endDate),
          status: { in: ['PRESENT', 'LATE', 'HALF_DAY', 'GRACE', 'SHORT_HOURS'] },
        },
      });
      const lateCount = await this.prisma.attendanceRecord.count({
        where: {
          employee: { departmentId: dept.id },
          date: this.dateRange(startDate, endDate),
          status: 'LATE',
        },
      });
      results.push({ department: dept.name, presentCount: records, lateCount });
    }
    return results;
  }

  /**
   * One endpoint behind every report on Personnel > Reports (Late, Absent,
   * Overtime, Present, Early Out, Missing Punch) and the matching Attendance
   * tabs -- same row shape for all, so the screen only differs by columns.
   * Filters: date range, department, a single employee, and the employee's
   * assigned shift. Absent is worked out (there is no stored row for a day
   * nobody punched), skipping holidays, approved leave, a rostered day off
   * and the shift's weekend days.
   */
  async attendanceDetail(f: AttendanceDetailFilters) {
    const start = startOfDay(f.startDate ? new Date(f.startDate) : new Date());
    const end = startOfDay(f.endDate ? new Date(f.endDate) : start);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new BadRequestException('Invalid date');
    if (end < start) throw new BadRequestException('endDate must not be before startDate');
    if ((end.getTime() - start.getTime()) / 86400000 > 92) {
      throw new BadRequestException('Pick a range of at most 3 months.');
    }

    const employeeFilter: any = {};
    if (f.departmentId) employeeFilter.departmentId = f.departmentId;
    if (f.shiftId) employeeFilter.shiftId = f.shiftId;
    if (f.employeeId) employeeFilter.id = f.employeeId;

    if (f.type === 'absent') {
      const rows = await this.absentRows(start, end, employeeFilter);
      return { type: f.type, total: rows.length, rows };
    }

    const where: any = { date: { gte: start, lte: end } };
    if (Object.keys(employeeFilter).length) where.employee = employeeFilter;
    switch (f.type) {
      case 'late':
        where.status = 'LATE';
        break;
      case 'present':
        where.status = { in: ['PRESENT', 'LATE', 'HALF_DAY', 'GRACE', 'SHORT_HOURS', 'HOLIDAY_DUTY'] };
        break;
      case 'overtime':
        where.overtimeMinutes = { gt: 0 };
        break;
      case 'early-out':
        where.earlyLeaveMinutes = { gt: 0 };
        break;
      case 'missing-punch':
        where.OR = [
          { checkIn: { not: null }, checkOut: null },
          { checkIn: null, checkOut: { not: null } },
        ];
        break;
      default:
        throw new BadRequestException('Unknown report type');
    }

    const records = await this.prisma.attendanceRecord.findMany({
      where,
      include: {
        employee: {
          select: {
            fullName: true,
            employeeCode: true,
            department: { select: { name: true } },
            shift: { select: { name: true, startTime: true, endTime: true } },
          },
        },
      },
      orderBy: [{ date: 'desc' }, { checkIn: 'asc' }],
      take: 5000,
    });

    const rows = records.map((r) => ({
      id: r.id,
      date: r.date,
      employeeId: r.employeeId,
      employeeName: r.employee.fullName,
      employeeCode: r.employee.employeeCode,
      department: r.employee.department?.name ?? null,
      shift: r.employee.shift?.name ?? null,
      scheduledIn: r.employee.shift?.startTime ?? null,
      scheduledOut: r.employee.shift?.endTime ?? null,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      workHours: r.workHours ? Number(r.workHours) : null,
      lateMinutes: r.lateMinutes,
      earlyLeaveMinutes: r.earlyLeaveMinutes,
      overtimeMinutes: r.overtimeMinutes,
      status: r.status,
      note: f.type === 'missing-punch' ? (r.checkIn ? 'Check-out missing' : 'Check-in missing') : r.notes ?? null,
    }));
    return { type: f.type, total: rows.length, rows };
  }

  private async absentRows(start: Date, end: Date, employeeFilter: any) {
    const today = startOfDay(new Date());
    const now = new Date();
    const lastDay = end > today ? today : end; // never report a future day as absent
    if (lastDay < start) return [];

    const days: { date: Date; key: string; dow: number }[] = [];
    for (let d = new Date(start); d <= lastDay; d.setDate(d.getDate() + 1)) {
      const c = new Date(d);
      days.push({ date: c, key: c.toISOString().slice(0, 10), dow: c.getDay() });
    }
    const todayKey = today.toISOString().slice(0, 10);

    const employees = await this.prisma.employee.findMany({
      where: { status: 'ACTIVE', ...employeeFilter },
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        joiningDate: true,
        department: { select: { name: true } },
        shift: { select: { name: true, startTime: true, endTime: true, graceMinutes: true, weekendRule: true } },
      },
    });
    if (employees.length === 0) return [];
    const ids = employees.map((e) => e.id);

    const [records, leaves, holidays, rosters] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where: { employeeId: { in: ids }, date: { gte: start, lte: lastDay } },
        select: { employeeId: true, date: true, status: true, notes: true },
      }),
      this.prisma.leaveRequest.findMany({
        where: { employeeId: { in: ids }, status: 'APPROVED', startDate: { lte: lastDay }, endDate: { gte: start } },
        select: { employeeId: true, startDate: true, endDate: true },
      }),
      this.prisma.holiday.findMany({ where: { date: { gte: start, lte: lastDay } }, select: { date: true } }),
      this.prisma.rosterAssignment.findMany({
        where: { employeeId: { in: ids }, date: { gte: start, lte: lastDay }, status: 'APPROVED' },
        select: { employeeId: true, date: true, type: true },
      }),
    ]);

    const k = (d: Date) => d.toISOString().slice(0, 10);
    const recordAt = new Map(records.map((r) => [`${r.employeeId}|${k(r.date)}`, r]));
    const holidayKeys = new Set(holidays.map((h) => k(h.date)));
    const rosterAt = new Map(rosters.map((r) => [`${r.employeeId}|${k(r.date)}`, r.type]));
    const leaveByEmp = new Map<string, { s: string; e: string }[]>();
    for (const l of leaves) {
      const list = leaveByEmp.get(l.employeeId) ?? [];
      list.push({ s: k(l.startDate), e: k(l.endDate) });
      leaveByEmp.set(l.employeeId, list);
    }

    const rows: any[] = [];
    for (const emp of employees) {
      const weekend = weekendDays(emp.shift?.weekendRule);
      const joined = emp.joiningDate ? startOfDay(emp.joiningDate) : null;
      for (const day of days) {
        if (joined && joined > day.date) continue;
        if (holidayKeys.has(day.key)) continue;

        const rec = recordAt.get(`${emp.id}|${day.key}`);
        // A real row means they punched (or HR set a status by hand); only a
        // row that is itself marked ABSENT counts here.
        if (rec && rec.status !== 'ABSENT') continue;

        const planned = rosterAt.get(`${emp.id}|${day.key}`);
        if (!rec) {
          if (planned === 'OFF') continue;
          if (planned !== 'SHIFT' && weekend.has(day.dow)) continue;
          if (leaveByEmp.get(emp.id)?.some((l) => l.s <= day.key && day.key <= l.e)) continue;

          // Today isn't over: only count someone once their shift has well
          // started (start + grace + 1h; noon if they have no shift).
          if (day.key === todayKey) {
            let limit = 12 * 60;
            if (emp.shift?.startTime) {
              const [h, m] = emp.shift.startTime.split(':').map(Number);
              if (!Number.isNaN(h)) limit = h * 60 + (m || 0) + (emp.shift.graceMinutes ?? 0) + 60;
            }
            if (now.getHours() * 60 + now.getMinutes() < limit) continue;
          }
        }

        rows.push({
          id: `absent-${emp.id}-${day.key}`,
          date: new Date(`${day.key}T00:00:00.000Z`),
          employeeId: emp.id,
          employeeName: emp.fullName,
          employeeCode: emp.employeeCode,
          department: emp.department?.name ?? null,
          shift: emp.shift?.name ?? null,
          scheduledIn: emp.shift?.startTime ?? null,
          scheduledOut: emp.shift?.endTime ?? null,
          checkIn: null,
          checkOut: null,
          workHours: null,
          lateMinutes: 0,
          earlyLeaveMinutes: 0,
          overtimeMinutes: 0,
          status: 'ABSENT',
          note: rec?.notes ?? 'No punch recorded',
        });
        if (rows.length >= 5000) break;
      }
    }

    // Days an attendance policy turned into an absence (every N late / grace
    // arrivals). The person did punch on those days, so these sit alongside
    // the days with no punch -- flagged so reports can tell them apart.
    const byId = new Map(employees.map((e) => [e.id, e]));
    const policyAbsences = await this.prisma.policyAbsence.findMany({
      where: {
        employeeId: { in: ids },
        date: {
          gte: new Date(`${start.toISOString().slice(0, 10)}T00:00:00.000Z`),
          lte: new Date(`${lastDay.toISOString().slice(0, 10)}T00:00:00.000Z`),
        },
      },
      include: { occurrences: { select: { date: true }, orderBy: { date: 'asc' } } },
    });
    for (const a of policyAbsences) {
      const emp = byId.get(a.employeeId);
      if (!emp) continue;
      rows.push({
        id: `policy-absent-${a.id}`,
        date: a.date,
        employeeId: emp.id,
        employeeName: emp.fullName,
        employeeCode: emp.employeeCode,
        department: emp.department?.name ?? null,
        shift: emp.shift?.name ?? null,
        scheduledIn: emp.shift?.startTime ?? null,
        scheduledOut: emp.shift?.endTime ?? null,
        checkIn: null,
        checkOut: null,
        workHours: null,
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        overtimeMinutes: 0,
        status: 'ABSENT',
        policyAbsence: true,
        note: `${a.reason}: ${a.occurrences.map((o) => o.date.toISOString().slice(0, 10)).join(', ')}`,
      });
    }

    rows.sort((a, b) => b.date.getTime() - a.date.getTime() || a.employeeName.localeCompare(b.employeeName));
    return rows;
  }

  async deviceActivity() {
    return this.prisma.deviceLog.findMany({
      include: { device: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async syncHistoryReport() {
    return this.prisma.syncHistory.findMany({
      include: {
        employee: { select: { fullName: true, employeeCode: true } },
        device: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async auditLogReport() {
    return this.prisma.auditLog.findMany({
      include: { user: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  toCsv(rows: Record<string, any>[]): string {
    return toCsv(rows);
  }

  /** Flattens nested relation objects (e.g. employee.fullName) for CSV export. */
  flatten(rows: any[]): Record<string, any>[] {
    return rows.map((row) => {
      const flat: Record<string, any> = {};
      for (const [key, value] of Object.entries(row)) {
        if (value && typeof value === 'object' && !(value instanceof Date)) {
          for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, any>)) {
            if (nestedValue && typeof nestedValue === 'object' && !(nestedValue instanceof Date)) {
              for (const [k2, v2] of Object.entries(nestedValue as Record<string, any>)) {
                flat[`${key}_${nestedKey}_${k2}`] = v2;
              }
            } else {
              flat[`${key}_${nestedKey}`] = nestedValue;
            }
          }
        } else {
          flat[key] = value;
        }
      }
      return flat;
    });
  }
}
