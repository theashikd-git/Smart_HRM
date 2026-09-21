import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DeviceSyncService } from '../devices/device-sync.service';
import { UsersService } from '../users/users.service';
import { LeaveService } from '../leave/leave.service';
import { CreateEmployeeDto, EmployeeQueryDto, UpdateEmployeeDto } from './dto/employee.dto';

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private deviceSyncService: DeviceSyncService,
    private usersService: UsersService,
    private leaveService: LeaveService,
  ) {}

  async create(dto: CreateEmployeeDto, actorId?: string) {
    const { staffUsername, staffPassword, ...employeeData } = dto;

    const employeeCode = dto.employeeCode?.trim() || (await this.generateEmployeeCode());

    const existing = await this.prisma.employee.findUnique({ where: { employeeCode } });
    if (existing) throw new ConflictException('Employee ID already exists');

    if (dto.deviceUserId) {
      const deviceIdTaken = await this.prisma.employee.findUnique({ where: { deviceUserId: dto.deviceUserId } });
      if (deviceIdTaken) throw new ConflictException('Device User ID is already assigned to another employee');
    }

    const category = await this.prisma.employeeCategory.findUnique({ where: { id: dto.leaveCategoryId } });
    if (!category) throw new BadRequestException('Employee category not found');
    this.assertTrialMonths(category, dto.trialMonths);

    // Fail before creating anything if Administrator was picked without the
    // credentials it needs -- staffUsername/staffPassword aren't columns on
    // Employee, so they're stripped out of employeeData above and handled
    // separately below, after the employee row (and its Employee ID) exist.
    if (dto.employeeRole === 'ADMINISTRATOR' && (!staffUsername || !staffPassword)) {
      throw new BadRequestException('Staff username and password are required when Employee Role is Administrator');
    }

    const joiningDate = dto.joiningDate ? new Date(dto.joiningDate) : undefined;

    const employee = await this.prisma.employee.create({
      data: {
        ...employeeData,
        employeeCode,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        joiningDate,
        // Anchors the leave-category clock: Permanent's 1-year mark,
        // Provision's 6-month mark, Contractual's 1-year carry-forward
        // mark, and Trial's custom duration are all measured from here.
        // Uses the joining date when one was given so a backdated hire
        // starts its clock correctly instead of from today.
        categorySince: joiningDate ?? new Date(),
        trialMonths: category.hasFixedPeriod ? dto.trialMonths : undefined,
        syncStatus: 'PENDING',
      },
      include: this.includeRelations(),
    });

    await this.auditService.log({
      userId: actorId,
      action: 'EMPLOYEE_CREATED',
      entity: 'Employee',
      entityId: employee.id,
      details: `Created employee ${employee.fullName} (${employee.employeeCode})`,
    });

    // Push to the biometric device in the background instead of awaiting
    // it here -- a real device can take anywhere from a few seconds to
    // ~30+ seconds to answer (or time out) over the network, and the
    // employee is already saved at this point, so there's no reason to
    // make HR wait on the device before seeing that. The employee record
    // already carries syncStatus: 'PENDING' (set above) and the UI treats
    // PENDING the same as a plain success; pushNewEmployee updates it to
    // SYNCED/FAILED once the device actually responds, and a FAILED sync
    // can still be retried from the Device page or by the scheduled
    // auto-retry. pushNewEmployee never throws (it catches its own device
    // errors and records them as a FAILED sync instead), so this can't
    // turn a device hiccup into an unhandled rejection.
    this.deviceSyncService.pushNewEmployee(employee.id).catch(() => undefined);

    // Provision this employee's login based on Employee Role:
    // EMPLOYEE/MANAGER/SUPERVISOR (or omitted, same default as before this
    // field existed) get the ordinary self-service login -- username and
    // default password are both their Employee ID (see UsersService.create's
    // EMPLOYEE branch), with mustChangePassword set so they're forced to
    // change it on first login. ADMINISTRATOR instead gets a staff login
    // (role ADMIN) with the username/password HR entered on this form --
    // already validated above, so staffUsername/staffPassword are safe to
    // use here. Never let a login-provisioning hiccup turn into a failed
    // employee creation; HR can still add the account by hand from System
    // Settings (or via Reset Password, which self-heals a missing login) if
    // this one call happens to fail.
    const loginPayload =
      dto.employeeRole === 'ADMINISTRATOR'
        ? { role: 'ADMIN' as any, username: staffUsername, fullName: employee.fullName, password: staffPassword, employeeId: employee.id }
        : { role: 'EMPLOYEE' as any, employeeId: employee.id };
    await this.usersService.create(loginPayload, actorId).catch((err) => {
      this.logger.error(`Failed to auto-provision login for employee ${employee.id}: ${err?.message ?? err}`);
    });

    // Grant this employee's actual leave balances now, from whatever
    // LeaveCategoryPolicy rows exist for their category -- without this, an
    // employee shows "0 day(s) remaining" for every leave type even though
    // HR configured (e.g.) Permanent's Annual/Casual/Sick, because nothing
    // else ever creates the LeaveBalance rows the portal reads from. Scoped
    // to just this employee, so it's cheap enough to await inline.
    await this.leaveService.initializeBalances({ employeeId: employee.id }, actorId).catch((err) => {
      this.logger.error(`Failed to initialize leave balances for employee ${employee.id}: ${err?.message ?? err}`);
    });

    return this.findOne(employee.id);
  }

  async findAll(query: EmployeeQueryDto) {
    const page = query.page ? Math.max(parseInt(query.page, 10), 1) : 1;
    const pageSize = query.pageSize ? Math.max(parseInt(query.pageSize, 10), 1) : 20;

    const where: any = {};
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.designationId) where.designationId = query.designationId;
    if (query.shiftId) where.shiftId = query.shiftId;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { employeeCode: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        include: this.includeRelations(),
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.employee.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findOne(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: { ...this.includeRelations(), documents: true },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async update(id: string, dto: UpdateEmployeeDto, actorId?: string, actorRole?: string) {
    const { staffUsername, staffPassword, ...employeeData } = dto;

    const current = await this.findOne(id);

    // Only an Administrator can *promote* someone to Administrator through
    // this field -- but compare against the employee's current Employee
    // Role first, so HR saving an unrelated field on an employee who is
    // already an Administrator doesn't get blocked just because the form
    // resubmits the unchanged value.
    if (dto.employeeRole === 'ADMINISTRATOR' && current.employeeRole !== 'ADMINISTRATOR' && actorRole !== 'ADMIN') {
      throw new ForbiddenException('Only an Administrator can set Employee Role to Administrator');
    }

    if (dto.employeeCode) {
      const codeTaken = await this.prisma.employee.findUnique({ where: { employeeCode: dto.employeeCode } });
      if (codeTaken && codeTaken.id !== id) {
        throw new ConflictException('Employee ID is already assigned to another employee');
      }
    }

    if (dto.deviceUserId) {
      const deviceIdTaken = await this.prisma.employee.findUnique({ where: { deviceUserId: dto.deviceUserId } });
      if (deviceIdTaken && deviceIdTaken.id !== id) {
        throw new ConflictException('Device User ID is already assigned to another employee');
      }
    }

    const nextCategoryId = dto.leaveCategoryId ?? current.leaveCategoryId;
    if (nextCategoryId) {
      const nextCategory = await this.prisma.employeeCategory.findUnique({ where: { id: nextCategoryId } });
      if (!nextCategory) throw new BadRequestException('Employee category not found');
      this.assertTrialMonths(nextCategory, dto.trialMonths ?? current.trialMonths ?? undefined);
    }
    const categoryChanged = dto.leaveCategoryId != null && dto.leaveCategoryId !== current.leaveCategoryId;

    // Fail before writing anything if Employee Role is being set to
    // Administrator and there's neither an existing staff login for this
    // employee nor fresh credentials to create one with.
    if (dto.employeeRole === 'ADMINISTRATOR') {
      const existingLogin = await this.prisma.user.findUnique({ where: { employeeId: id } });
      // 'Already a staff login' means specifically ADMIN here, matching
      // UsersService.syncLoginForEmployeeRole -- a Manager/Supervisor/HR/
      // Managing Director role set via System Settings is still an
      // Employee ID login and still needs fresh Admin credentials to
      // convert, same as a plain Employee ID login would.
      const alreadyStaffLogin = existingLogin && existingLogin.role === 'ADMIN';
      if (!alreadyStaffLogin && (!staffUsername || !staffPassword)) {
        throw new BadRequestException('Staff username and password are required when Employee Role is Administrator');
      }
    }

    const employee = await this.prisma.employee.update({
      where: { id },
      data: {
        ...employeeData,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : undefined,
        // A category change starts a fresh clock (e.g. Provision ->
        // Permanent should count the 1-year mark from today, not from
        // whenever they originally joined as Provision).
        ...(categoryChanged ? { categorySince: new Date() } : {}),
        syncStatus: 'PENDING',
      },
      include: this.includeRelations(),
    });

    await this.auditService.log({
      userId: actorId,
      action: 'EMPLOYEE_UPDATED',
      entity: 'Employee',
      entityId: id,
    });

    // Same reasoning as create(): don't make HR wait on the biometric
    // device -- push in the background. The employee already carries
    // syncStatus: 'PENDING' (set above), which the UI treats the same as
    // a plain save success; pushUpdate flips it to SYNCED/FAILED once the
    // device responds, and a FAILED sync can still be retried from the
    // Device page or the scheduled auto-retry.
    this.deviceSyncService.pushUpdate(id).catch(() => undefined);

    // A category change (e.g. Provision -> Permanent) can newly qualify
    // this employee for leave types they had no LeaveCategoryPolicy row for
    // before -- grant those balances now rather than leaving them at 0 until
    // someone happens to re-run initialization. Existing balances (from the
    // old category, or already granted this year) are left untouched.
    if (categoryChanged) {
      await this.leaveService.initializeBalances({ employeeId: id }, actorId).catch((err) => {
        this.logger.error(`Failed to initialize leave balances for employee ${id}: ${err?.message ?? err}`);
      });
    }

    // Keep this employee's login in sync with Employee Role, if it was
    // included on this save -- converts between the Employee ID login and
    // an Administrator staff login as needed (see
    // UsersService.syncLoginForEmployeeRole). Deliberately not
    // caught-and-logged like the device/leave-balance calls above: a
    // missing-credentials failure here needs to reach HR immediately, not
    // be silently swallowed, since it means the login change didn't happen.
    if (dto.employeeRole !== undefined) {
      await this.usersService.syncLoginForEmployeeRole(id, dto.employeeRole, staffUsername, staffPassword, actorId);
    }

    return this.findOne(id);
  }

  async disable(id: string, actorId?: string) {
    const employee = await this.findOne(id);
    const updated = await this.prisma.employee.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
    await this.auditService.log({
      userId: actorId,
      action: 'EMPLOYEE_DISABLED',
      entity: 'Employee',
      entityId: id,
    });
    if (employee.deviceUserId) {
      this.deviceSyncService.pushDelete(id, employee.deviceUserId).catch(() => undefined);
    }
    return updated;
  }

  async activate(id: string, actorId?: string) {
    await this.findOne(id);
    await this.prisma.employee.update({
      where: { id },
      data: { status: 'ACTIVE', syncStatus: 'PENDING' },
    });
    await this.auditService.log({
      userId: actorId,
      action: 'EMPLOYEE_ACTIVATED',
      entity: 'Employee',
      entityId: id,
    });
    await this.deviceSyncService.pushNewEmployee(id).catch(() => undefined);
    return this.findOne(id);
  }

  /** HR/Admin "forgot password" reset for this employee's self-service
   *  login -- delegates to UsersService, which generates and returns a
   *  fresh temporary password (mustChangePassword is set so the employee
   *  has to choose their own on next sign-in). findOne(id) first so a bad
   *  employee id 404s clearly rather than surfacing UsersService's own
   *  "no login account" error for an employee that doesn't exist at all. */
  async resetPassword(id: string, actorId?: string) {
    await this.findOne(id);
    return this.usersService.resetPasswordByEmployeeId(id, actorId);
  }

  async remove(id: string, actorId?: string) {
    const employee = await this.findOne(id);

    // Best-effort: Smart HRM stays the source of truth, so the employee is
    // removed here even if the device can't be reached -- but unlike a
    // failed create/update push, a failed delete has no employee row left
    // to retry against afterwards, so the outcome is captured and handed
    // back to the caller instead of being silently swallowed.
    let deviceRemoval: { success: boolean; message?: string } | undefined;
    if (employee.deviceUserId) {
      deviceRemoval = await this.deviceSyncService.pushDelete(id, employee.deviceUserId).catch((err: any) => ({
        success: false,
        message: err?.message ?? 'Unknown error',
      }));
    }

    await this.prisma.employee.delete({ where: { id } });

    await this.auditService.log({
      userId: actorId,
      action: 'EMPLOYEE_DELETED',
      entity: 'Employee',
      entityId: id,
      details: `Deleted employee ${employee.fullName} (${employee.employeeCode})`,
    });

    return { success: true, deviceRemoval };
  }

  /**
   * Employee ID is a plain number now (e.g. "6783"), not a prefixed code
   * like "EMP-6783". Generated here when the Add Employee form is left on
   * its auto-filled default and the user never typed their own -- retries
   * a few times against the unique constraint in the unlikely event of a
   * collision rather than trusting client-side randomness alone.
   */
  private async generateEmployeeCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = String(Math.floor(1000 + Math.random() * 9000));
      const taken = await this.prisma.employee.findUnique({ where: { employeeCode: candidate } });
      if (!taken) return candidate;
    }
    // Extremely unlikely fallback: timestamp-based, still numeric-looking.
    return String(Date.now()).slice(-6);
  }

  // A fixed-period category (Provision's probation, Trial's trial period)
  // needs a duration to count down: the category's own defaultPeriodMonths
  // if it has one, otherwise HR must give this specific employee one via
  // trialMonths (mirrors the old hardcoded "TRIAL requires trialMonths"
  // rule, generalized to any category that opts into a fixed period).
  private assertTrialMonths(category: { hasFixedPeriod: boolean; defaultPeriodMonths: number | null }, trialMonths?: number) {
    if (category.hasFixedPeriod && category.defaultPeriodMonths == null && !trialMonths) {
      throw new BadRequestException('trialMonths is required for this employee category');
    }
  }

  private includeRelations() {
    return {
      department: { select: { id: true, name: true, code: true } },
      designation: { select: { id: true, title: true } },
      shift: { select: { id: true, name: true, startTime: true, endTime: true } },
      leaveCategory: true,
      // The employee's own login account (if any) -- lets the Employee
      // profile screen show/change their access level (Employee, Supervisor,
      // Manager) without a separate trip to System Settings.
      account: { select: { id: true, role: true, isActive: true } },
    };
  }
}
