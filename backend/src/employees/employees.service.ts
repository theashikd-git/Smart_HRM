import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DeviceSyncService } from '../devices/device-sync.service';
import { UsersService } from '../users/users.service';
import { CreateEmployeeDto, EmployeeQueryDto, UpdateEmployeeDto } from './dto/employee.dto';

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private deviceSyncService: DeviceSyncService,
    private usersService: UsersService,
  ) {}

  async create(dto: CreateEmployeeDto, actorId?: string) {
    const employeeCode = dto.employeeCode?.trim() || (await this.generateEmployeeCode());

    const existing = await this.prisma.employee.findUnique({ where: { employeeCode } });
    if (existing) throw new ConflictException('Employee ID already exists');

    if (dto.deviceUserId) {
      const deviceIdTaken = await this.prisma.employee.findUnique({ where: { deviceUserId: dto.deviceUserId } });
      if (deviceIdTaken) throw new ConflictException('Device User ID is already assigned to another employee');
    }

    const employee = await this.prisma.employee.create({
      data: {
        ...dto,
        employeeCode,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : undefined,
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

    // Push to the biometric device and wait for the outcome so the
    // response the UI receives already reflects the real syncStatus
    // (SYNCED or FAILED) -- no separate trip to the Device page needed to
    // find out whether it worked. pushNewEmployee never throws (it catches
    // its own device errors and records them as a FAILED sync instead),
    // so this can't turn a device hiccup into a failed employee creation.
    await this.deviceSyncService.pushNewEmployee(employee.id).catch(() => undefined);

    // Auto-provision this employee's self-service login -- username and
    // default password are both their Employee ID (see UsersService.create's
    // EMPLOYEE branch), with mustChangePassword set so they're forced to
    // change it on first login. Never let a login-provisioning hiccup turn
    // into a failed employee creation; HR can still add the account by hand
    // from System Settings if this one call happens to fail.
    await this.usersService.create({ role: 'EMPLOYEE' as any, employeeId: employee.id }, actorId).catch((err) => {
      this.logger.error(`Failed to auto-provision login for employee ${employee.id}: ${err?.message ?? err}`);
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

  async update(id: string, dto: UpdateEmployeeDto, actorId?: string) {
    await this.findOne(id);

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

    const employee = await this.prisma.employee.update({
      where: { id },
      data: {
        ...dto,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : undefined,
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

    // Same reasoning as create(): wait for the push so the response
    // already carries the real sync outcome.
    await this.deviceSyncService.pushUpdate(id).catch(() => undefined);

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

  private includeRelations() {
    return {
      department: { select: { id: true, name: true, code: true } },
      designation: { select: { id: true, title: true } },
      shift: { select: { id: true, name: true, startTime: true, endTime: true } },
      // The employee's own login account (if any) -- lets the Employee
      // profile screen show/change their access level (Employee, Supervisor,
      // Manager) without a separate trip to System Settings.
      account: { select: { id: true, role: true, isActive: true } },
    };
  }
}
