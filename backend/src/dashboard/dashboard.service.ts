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
   * Department ids (+ names) this login "leads", for every My Team-style
   * dashboard panel: departments where their linked Employee is the
   * configured Department Manager (Department.headEmployeeId), UNION
   * departments whose active leave approval workflow names this login (by
   * User id) as a fixed SPECIFIC_USER tier approver -- e.g. a Supervisor
   * tier (see LeaveController's leave workflow setup). REPORTING_SUPERIOR
   * tiers resolve to the department's Manager at decision time (see
   * LeaveService.resolveTierApprover), so they're already covered by the
   * headEmployeeId half of this union and aren't queried again here.
   */
  private async resolveLedDepartments(userId: string, employeeId: string | null) {
    const [headed, tiered] = await Promise.all([
      employeeId
        ? this.prisma.department.findMany({
            where: { headEmployeeId: employeeId },
            select: { id: true, name: true },
          })
        : Promise.resolve([] as { id: string; name: string }[]),
      this.prisma.leaveApprovalTier.findMany({
        where: { type: 'SPECIFIC_USER', approverUserId: userId, workflow: { isActive: true } },
        select: { workflow: { select: { department: { select: { id: true, name: true } } } } },
      }),
    ]);

    const byId = new Map<string, { id: string; name: string }>();
    headed.forEach((d) => byId.set(d.id, d));
    tiered.forEach((t) => {
      const dept = t.workflow.department;
      if (!byId.has(dept.id)) byId.set(dept.id, dept);
    });

    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * "My Team" panel for a department-leading login's dashboard -- only
   * returns data when the signed-in login leads one or more departments
   * (see resolveLedDepartments: department head OR a named leave-approval
   * tier). Deliberately keyed off those data facts, not the User's Role --
   * an ADMIN or MANAGING_DIRECTOR set as a department head or tier approver
   * sees this too, and a MANAGER/SUPERVISOR named nowhere does not.
   */
  async myTeamAttendance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { employeeId: true },
    });

    if (!user?.employeeId) {
      return { isManager: false, departments: [], members: [] };
    }

    const departments = await this.resolveLedDepartments(userId, user.employeeId);

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
        // Not used by the attendance list itself -- carried along so the
        // Manager Portal's "Leave on Behalf" employee picker (reusing this
        // same team list) has what NewLeaveRequestModal's Maternity Leave
        // eligibility hint needs, without a second round-trip.
        gender: true,
        joiningDate: true,
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
        gender: e.gender,
        joiningDate: e.joiningDate,
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
   * Same department-lead gating (see resolveLedDepartments) as
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

    const departments = await this.resolveLedDepartments(userId, user.employeeId);

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
   * by myTeamAttendance/summary. Same department-lead gating (see
   * resolveLedDepartments) as myTeamAttendance above.
   */
  async myTeamRecentPunches(userId: string, limit = 30) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { employeeId: true },
    });

    if (!user?.employeeId) {
      return { isManager: false, punches: [] };
    }

    const departments = await this.resolveLedDepartments(userId, user.employeeId);

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
