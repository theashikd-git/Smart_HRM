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
