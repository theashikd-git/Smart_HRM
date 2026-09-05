import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
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
          status: { in: ['PRESENT', 'LATE', 'HALF_DAY'] },
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
