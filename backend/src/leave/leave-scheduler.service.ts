import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function daysBetween(from: Date, to: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

function isSameMonthDay(a: Date, b: Date): boolean {
  return a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * The two scheduled jobs the 7-type leave policy needs beyond what happens
 * at request-time (LeaveService.create's balance/eligibility checks):
 *
 *  1. Anniversary balance rollover for PERMANENT/CONTRACTUAL employees --
 *     each employee's own hire/category anniversary is their personal
 *     "leave year" boundary (confirmed with HR: anniversary-based, not a
 *     shared calendar-year reset), so this runs daily and only acts on
 *     employees whose anniversary is today.
 *  2. HR notification 2 weeks before a PROVISION or TRIAL period ends, via
 *     the existing Audit Log (see LeaveModule's AuditModule import) rather
 *     than a new staff-facing notification -- most ADMIN/HR accounts have
 *     no linked Employee record, and the Notification model is keyed by
 *     employeeId.
 *
 * Both jobs are safe to run more than once on the same day for the same
 * employee: the rollover only ever creates a balance row that doesn't yet
 * exist (never overwrites one), and the notification is naturally a
 * one-day-only match (the "exactly 14 days before period end" condition is
 * only ever true for a single calendar day per period), so a duplicate run
 * produces no duplicate audit entries beyond what a second look at the same
 * day would anyway.
 */
@Injectable()
export class LeaveSchedulerService {
  private readonly logger = new Logger(LeaveSchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  // Runs once a day, at 01:00 server time.
  @Cron('0 1 * * *')
  async handleAnniversaryRollover() {
    try {
      const result = await this.runAnniversaryRollover();
      if (result.processed > 0) {
        this.logger.log(`Anniversary leave rollover: ${result.processed} balance row(s) created`);
      }
    } catch (err: any) {
      this.logger.error(`Anniversary leave rollover failed: ${err?.message ?? err}`);
    }
  }

  // Runs once a day, at 02:00 server time.
  @Cron('0 2 * * *')
  async handlePeriodEndingNotifications() {
    try {
      const result = await this.notifyUpcomingPeriodEndings();
      if (result.notified > 0) {
        this.logger.log(`Leave period-ending notifications: ${result.notified} employee(s) flagged for HR`);
      }
    } catch (err: any) {
      this.logger.error(`Leave period-ending notification job failed: ${err?.message ?? err}`);
    }
  }

  /**
   * For every active PERMANENT/CONTRACTUAL employee whose categorySince
   * anniversary is today: carries forward each policy-eligible leave type's
   * unused balance into the new personal leave year, per that
   * (category, leaveType) row in LeaveCategoryPolicy --
   *   - carryForward: false (e.g. Permanent's Casual/Sick) -> resets to 0,
   *     nothing carried.
   *   - carryForward: true with maxCarryForwardDays set (Permanent's Annual
   *     Leave: 16/year, up to 8 carried, the rest forfeited) -> carries
   *     min(leftover, maxCarryForwardDays).
   *   - carryForwardOnce: true (Contractual's Casual/Sick: 10/year, carried
   *     forward exactly once) -> only acts on the employee's very first
   *     anniversary; from the second anniversary onward this leave type is
   *     left alone entirely (no new allocation, nothing swept away either).
   */
  async runAnniversaryRollover(today: Date = new Date()) {
    const employees = await this.prisma.employee.findMany({
      where: { status: 'ACTIVE', leaveCategory: { in: ['PERMANENT', 'CONTRACTUAL'] }, categorySince: { not: null } },
    });
    const dueToday = employees.filter((e) => e.categorySince && isSameMonthDay(e.categorySince, today));
    if (dueToday.length === 0) return { processed: 0 };

    const policies = await this.prisma.leaveCategoryPolicy.findMany({ include: { leaveType: true } });
    const policyByCategory = new Map<string, typeof policies>();
    for (const p of policies) {
      const list = policyByCategory.get(p.leaveCategory) ?? [];
      list.push(p);
      policyByCategory.set(p.leaveCategory, list);
    }

    const toYear = today.getFullYear();
    const fromYear = toYear - 1;
    let processed = 0;

    for (const employee of dueToday) {
      const employmentYears = today.getFullYear() - employee.categorySince!.getFullYear();
      const categoryPolicies = policyByCategory.get(employee.leaveCategory!) ?? [];

      for (const policy of categoryPolicies) {
        if (employee.leaveCategory === 'CONTRACTUAL' && policy.carryForwardOnce && employmentYears > 1) {
          // Already rolled over once on their first anniversary -- from the
          // second anniversary onward this leave type gets no further
          // action (no new grant, nothing else carried).
          continue;
        }

        const alreadyRolled = await this.prisma.leaveBalance.findUnique({
          where: {
            employeeId_leaveTypeId_year: { employeeId: employee.id, leaveTypeId: policy.leaveTypeId, year: toYear },
          },
        });
        if (alreadyRolled) continue; // idempotent -- never touch an existing row

        const previous = await this.prisma.leaveBalance.findUnique({
          where: {
            employeeId_leaveTypeId_year: { employeeId: employee.id, leaveTypeId: policy.leaveTypeId, year: fromYear },
          },
        });
        const leftover = previous
          ? Math.max(0, Number(previous.allocated) + Number(previous.carriedForward) - Number(previous.used))
          : 0;
        const carriedForward = policy.carryForward
          ? Math.min(leftover, policy.maxCarryForwardDays != null ? Number(policy.maxCarryForwardDays) : leftover)
          : 0;

        await this.prisma.leaveBalance.create({
          data: {
            employeeId: employee.id,
            leaveTypeId: policy.leaveTypeId,
            year: toYear,
            allocated: policy.daysPerCycle,
            carriedForward,
            used: 0,
          },
        });
        processed++;
      }

      await this.auditService.log({
        action: 'LEAVE_ANNIVERSARY_ROLLOVER',
        entity: 'Employee',
        entityId: employee.id,
        details: `${employee.fullName}: leave balances rolled over for their ${employmentYears}-year ${employee.leaveCategory} anniversary`,
      });
    }

    return { processed };
  }

  /**
   * Flags, via the Audit Log, every PROVISION employee whose 6-month
   * probation ends in exactly 2 weeks and every TRIAL employee whose
   * HR/admin-chosen trial duration ends in exactly 2 weeks -- so HR can
   * decide (Provision) to extend for another 6 months or confirm as
   * Permanent, or (Trial) act before the trial runs out.
   */
  async notifyUpcomingPeriodEndings(today: Date = new Date()) {
    const employees = await this.prisma.employee.findMany({
      where: { status: 'ACTIVE', leaveCategory: { in: ['PROVISION', 'TRIAL'] }, categorySince: { not: null } },
    });

    let notified = 0;
    for (const employee of employees) {
      const periodEnd =
        employee.leaveCategory === 'PROVISION'
          ? addMonths(employee.categorySince!, 6)
          : addMonths(employee.categorySince!, employee.trialMonths ?? 0);

      if (daysBetween(today, periodEnd) !== 14) continue;

      const periodLabel = employee.leaveCategory === 'PROVISION' ? 'Provision (probation)' : 'Trial';
      await this.auditService.log({
        action: 'LEAVE_PERIOD_ENDING_SOON',
        entity: 'Employee',
        entityId: employee.id,
        details:
          employee.leaveCategory === 'PROVISION'
            ? `${employee.fullName}'s Provision period ends ${periodEnd.toISOString().slice(0, 10)} (2 weeks from now) -- decide whether to extend another 6 months or confirm as Permanent`
            : `${employee.fullName}'s Trial period ends ${periodEnd.toISOString().slice(0, 10)} (2 weeks from now) -- ${periodLabel} is about to run out`,
      });
      notified++;
    }

    return { notified };
  }
}
