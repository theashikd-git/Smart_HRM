import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async summary() {
    const today = startOfDay(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [totalEmployees, activeEmployees, presentToday, lateToday, device] = await Promise.all([
      this.prisma.employee.count(),
      this.prisma.employee.count({ where: { status: 'ACTIVE' } }),
      this.prisma.attendanceRecord.count({
        where: { date: { gte: today, lt: tomorrow }, status: { in: ['PRESENT', 'LATE', 'HALF_DAY'] } },
      }),
      this.prisma.attendanceRecord.count({
        where: { date: { gte: today, lt: tomorrow }, status: 'LATE' },
      }),
      this.prisma.device.findFirst({ orderBy: { createdAt: 'asc' } }),
    ]);

    const absentToday = Math.max(activeEmployees - presentToday, 0);

    const recentActivity = await this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { user: { select: { fullName: true } } },
    });

    return {
      totalEmployees,
      activeEmployees,
      presentToday,
      absentToday,
      lateToday,
      deviceStatus: device?.connectionStatus || 'UNKNOWN',
      deviceName: device?.name || null,
      recentActivity,
    };
  }

  async weeklyAttendance() {
    const days: { date: string; present: number; late: number; absent: number }[] = [];
    const activeEmployees = await this.prisma.employee.count({ where: { status: 'ACTIVE' } });

    for (let i = 6; i >= 0; i--) {
      const day = startOfDay(new Date());
      day.setDate(day.getDate() - i);
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);

      const [present, late] = await Promise.all([
        this.prisma.attendanceRecord.count({
          where: { date: { gte: day, lt: nextDay }, status: { in: ['PRESENT', 'HALF_DAY'] } },
        }),
        this.prisma.attendanceRecord.count({
          where: { date: { gte: day, lt: nextDay }, status: 'LATE' },
        }),
      ]);

      days.push({
        date: day.toISOString().slice(0, 10),
        present,
        late,
        absent: Math.max(activeEmployees - present - late, 0),
      });
    }

    return days;
  }

  async departmentAttendance() {
    const departments = await this.prisma.department.findMany({
      include: { employees: { select: { id: true, status: true } } },
    });

    const today = startOfDay(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result: { department: string; employees: number; present: number }[] = [];
    for (const dept of departments) {
      const activeIds = dept.employees.filter((e) => e.status === 'ACTIVE').map((e) => e.id);
      const present = activeIds.length
        ? await this.prisma.attendanceRecord.count({
            where: {
              employeeId: { in: activeIds },
              date: { gte: today, lt: tomorrow },
              status: { in: ['PRESENT', 'LATE', 'HALF_DAY'] },
            },
          })
        : 0;
      result.push({ department: dept.name, employees: activeIds.length, present });
    }

    return result;
  }

  /**
   * "My Team" panel for a department head's dashboard -- only returns data
   * when the signed-in user's linked Employee is set as headEmployeeId on
   * one or more departments (see Department.manager in schema.prisma).
   * Deliberately keyed off that, not off the User's Role, since being a
   * department's Manager is a data fact (who's set as its head), not a
   * permission level -- an ADMIN or MANAGING_DIRECTOR set as a department
   * head sees this too, and a MANAGER not set as anyone's head does not.
   */
  async myTeamAttendance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { employeeId: true },
    });

    if (!user?.employeeId) {
      return { isManager: false, departments: [], members: [] };
    }

    const departments = await this.prisma.department.findMany({
      where: { headEmployeeId: user.employeeId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    if (departments.length === 0) {
      return { isManager: false, departments: [], members: [] };
    }

    const today = startOfDay(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const employees = await this.prisma.employee.findMany({
      where: {
        departmentId: { in: departments.map((d) => d.id) },
        status: 'ACTIVE',
        id: { not: user.employeeId }, // the department head isn't part of their own "team" list
      },
      select: {
        id: true,
        fullName: true,
        employeeCode: true,
        photo: true,
        attendanceRecords: {
          where: { date: { gte: today, lt: tomorrow } },
          select: { checkIn: true, checkOut: true, status: true },
          take: 1,
        },
      },
      orderBy: { fullName: 'asc' },
    });

    const members = employees.map((e) => {
      const record = e.attendanceRecords[0];
      return {
        id: e.id,
        fullName: e.fullName,
        employeeCode: e.employeeCode,
        photo: e.photo,
        checkIn: record?.checkIn ?? null,
        checkOut: record?.checkOut ?? null,
        status: record?.status ?? 'ABSENT',
        present: !!record,
      };
    });

    return {
      isManager: true,
      departments: departments.map((d) => d.name),
      members,
    };
  }

  /**
   * Every APPROVED leave for this department head's team that's current or
   * still upcoming (endDate hasn't passed yet) -- so a request shows up
   * here the moment it's approved, not just on the day it actually starts.
   * Same department-head gating (Department.headEmployeeId) as
   * myTeamAttendance above. Deliberately its own query rather than reusing
   * myTeamAttendance's per-day ON_LEAVE attendance status, which only ever
   * reflects TODAY -- a manager approving someone's leave for next month
   * should see it land here right away.
   */
  async myTeamOnLeave(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { employeeId: true },
    });

    if (!user?.employeeId) {
      return { isManager: false, leaves: [] };
    }

    const departments = await this.prisma.department.findMany({
      where: { headEmployeeId: user.employeeId },
      select: { id: true },
    });

    if (departments.length === 0) {
      return { isManager: false, leaves: [] };
    }

    const today = startOfDay(new Date());

    const leaves = await this.prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        endDate: { gte: today },
        employee: {
          departmentId: { in: departments.map((d) => d.id) },
          id: { not: user.employeeId }, // the department head isn't part of their own "team" list
        },
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        session: true,
        totalDays: true,
        employee: { select: { id: true, fullName: true, employeeCode: true, photo: true } },
        leaveType: { select: { id: true, name: true, color: true } },
      },
      orderBy: { startDate: 'asc' },
    });

    return {
      isManager: true,
      leaves: leaves.map((l) => ({
        id: l.id,
        employeeId: l.employee.id,
        fullName: l.employee.fullName,
        employeeCode: l.employee.employeeCode,
        photo: l.employee.photo,
        leaveTypeName: l.leaveType.name,
        leaveTypeColor: l.leaveType.color,
        startDate: l.startDate,
        endDate: l.endDate,
        session: l.session,
        totalDays: l.totalDays,
      })),
    };
  }

  /**
   * Live feed for the "Real-Time Monitor" panel -- raw punch events (one row
   * per check-in/check-out), not the daily-aggregated AttendanceRecord used
   * by myTeamAttendance/summary. Same department-head gating as
   * myTeamAttendance above.
   */
  async myTeamRecentPunches(userId: string, limit = 30) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { employeeId: true },
    });

    if (!user?.employeeId) {
      return { isManager: false, punches: [] };
    }

    const departments = await this.prisma.department.findMany({
      where: { headEmployeeId: user.employeeId },
      select: { id: true },
    });

    if (departments.length === 0) {
      return { isManager: false, punches: [] };
    }

    const logs = await this.prisma.attendanceLog.findMany({
      where: {
        employee: {
          departmentId: { in: departments.map((d) => d.id) },
          id: { not: user.employeeId },
        },
      },
      include: {
        employee: { select: { id: true, fullName: true, employeeCode: true } },
        device: { select: { name: true } },
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return {
      isManager: true,
      punches: logs.map((l) => ({
        id: l.id,
        employeeId: l.employee.id,
        fullName: l.employee.fullName,
        employeeCode: l.employee.employeeCode,
        deviceName: l.device?.name ?? null,
        timestamp: l.timestamp,
        direction: l.inOutMode ?? null,
      })),
    };
  }

  async employeeGrowth() {
    const months: { month: string; count: number }[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const count = await this.prisma.employee.count({
        where: { createdAt: { lt: monthEnd } },
      });
      months.push({ month: monthStart.toISOString().slice(0, 7), count });
    }

    return months;
  }
}
