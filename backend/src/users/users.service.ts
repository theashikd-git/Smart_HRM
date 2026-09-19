import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

const SAFE_SELECT = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  isActive: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  employeeId: true,
  employee: { select: { id: true, employeeCode: true, fullName: true } },
};

// The physical User table still stores the login identifier in its `email`
// column (see UsersService.create for why), but the app now treats it as a
// generic, non-email "username". This strips the internal column name out
// of anything returned to callers.
function toSafeUser<T extends { email: string }>(user: T) {
  const { email, ...rest } = user;
  return { ...rest, username: email };
}

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(dto: CreateUserDto, actorId?: string) {
    // Employee self-service accounts: no username/password to collect --
    // derive both from the linked Employee record instead. Login for these
    // accounts is by Employee ID (see AuthService.employeeLogin), with the
    // Employee ID itself as the default password.
    if (dto.role === 'EMPLOYEE') {
      if (!dto.employeeId) {
        throw new BadRequestException('employeeId is required to create an employee login');
      }
      const employee = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
      if (!employee) throw new NotFoundException('Employee not found');

      const alreadyLinked = await this.prisma.user.findUnique({ where: { employeeId: dto.employeeId } });
      if (alreadyLinked) throw new ConflictException('This employee already has a login account');

      const passwordHash = await bcrypt.hash(employee.employeeCode, 10);
      const user = await this.prisma.user.create({
        data: {
          // Synthetic, unique placeholder -- the User table requires a
          // unique email column, but employee accounts log in by Employee ID
          // and never see or use this value.
          email: `${employee.employeeCode}@employee.smarthrm.local`,
          fullName: employee.fullName,
          role: 'EMPLOYEE',
          passwordHash,
          employeeId: employee.id,
          // Forces the "set a new password" gate on the employee portal
          // until they change it themselves -- the default password (their
          // own Employee ID) can't be relied on indefinitely.
          mustChangePassword: true,
        },
        select: SAFE_SELECT,
      });

      await this.auditService.log({
        userId: actorId,
        action: 'USER_CREATED',
        entity: 'User',
        entityId: user.id,
        details: `Created employee login for ${employee.fullName} (${employee.employeeCode})`,
      });

      return toSafeUser(user);
    }

    if (!dto.username || !dto.fullName || !dto.password) {
      throw new BadRequestException('username, fullName, and password are required for this role');
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.username } });
    if (existing) throw new ConflictException('A user with this username already exists');

    if (dto.employeeId) {
      const alreadyLinked = await this.prisma.user.findUnique({ where: { employeeId: dto.employeeId } });
      if (alreadyLinked) throw new ConflictException('This employee already has a login account');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.username,
        fullName: dto.fullName,
        role: dto.role,
        passwordHash,
        employeeId: dto.employeeId,
      },
      select: SAFE_SELECT,
    });

    await this.auditService.log({
      userId: actorId,
      action: 'USER_CREATED',
      entity: 'User',
      entityId: user.id,
      details: `Created user ${user.email} with role ${user.role}`,
    });

    return toSafeUser(user);
  }

  async findAll() {
    const users = await this.prisma.user.findMany({ select: SAFE_SELECT, orderBy: { createdAt: 'desc' } });
    return users.map(toSafeUser);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: SAFE_SELECT });
    if (!user) throw new NotFoundException('User not found');
    return toSafeUser(user);
  }

  async update(id: string, dto: UpdateUserDto, actorId?: string) {
    await this.findOne(id);

    const data: any = {
      fullName: dto.fullName,
      role: dto.role,
      isActive: dto.isActive,
    };
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }
    if (dto.employeeId !== undefined) {
      if (dto.employeeId) {
        const employee = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
        if (!employee) throw new NotFoundException('Employee not found');

        const alreadyLinked = await this.prisma.user.findUnique({ where: { employeeId: dto.employeeId } });
        if (alreadyLinked && alreadyLinked.id !== id) {
          throw new ConflictException('This employee already has a login account');
        }
        data.employeeId = dto.employeeId;
      } else {
        // Empty string -- explicit unlink.
        data.employeeId = null;
      }
    }

    const user = await this.prisma.user.update({ where: { id }, data, select: SAFE_SELECT });

    await this.auditService.log({
      userId: actorId,
      action: 'USER_UPDATED',
      entity: 'User',
      entityId: id,
    });

    return toSafeUser(user);
  }

  /**
   * HR/Admin "forgot password" reset for an employee's self-service login.
   * Generates a fresh temporary password, forces the employee to set their
   * own on next sign-in (same mustChangePassword gate as a brand-new
   * account, see create() above), and hands the plaintext password back
   * ONCE so HR/Admin can relay it to the employee -- it's hashed
   * immediately and never stored or logged in plain text.
   *
   * Self-healing: employees created before login auto-provisioning existed
   * (or whose auto-provisioning silently failed -- create() never lets a
   * login hiccup block employee creation) have no User row at all yet.
   * Rather than making HR find a separate "create login" step first, a
   * reset in that case just creates the login here, with the generated
   * temporary password in place of the old employeeCode-as-password
   * default.
   */
  async resetPasswordByEmployeeId(employeeId: string, actorId?: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');

    const existing = await this.prisma.user.findUnique({ where: { employeeId } });
    if (existing && existing.role !== 'EMPLOYEE') {
      throw new BadRequestException('This login is not an employee self-service account');
    }

    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    if (!existing) {
      const user = await this.prisma.user.create({
        data: {
          // Same synthetic placeholder as create()'s EMPLOYEE branch -- the
          // User table requires a unique email column, but this account
          // logs in by Employee ID and never sees or uses this value.
          email: `${employee.employeeCode}@employee.smarthrm.local`,
          fullName: employee.fullName,
          role: 'EMPLOYEE',
          passwordHash,
          employeeId: employee.id,
          mustChangePassword: true,
        },
      });

      await this.auditService.log({
        userId: actorId,
        action: 'USER_CREATED',
        entity: 'User',
        entityId: user.id,
        details: `Created employee login for ${employee.fullName} (${employee.employeeCode}) via password reset`,
      });

      return { tempPassword, created: true };
    }

    await this.prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, mustChangePassword: true },
    });

    await this.auditService.log({
      userId: actorId,
      action: 'USER_PASSWORD_RESET',
      entity: 'User',
      entityId: existing.id,
      details: `Password reset for employee login ${existing.email}`,
    });

    return { tempPassword, created: false };
  }

  /**
   * Keeps an employee's login in sync with their Employee Role, set on the
   * Add/Edit Employee form. EMPLOYEE/MANAGER/SUPERVISOR all use the
   * ordinary Employee ID self-service login (role EMPLOYEE) -- Employee
   * Role is just a label for these three, exactly like before this field
   * existed. ADMINISTRATOR instead gets a staff login (role ADMIN) with
   * the given username/password, logging in like an HR/Admin user rather
   * than through the employee portal.
   *
   * An employee can only ever be linked to one User row (unique employeeId
   * constraint), so switching between the two buckets converts the
   * existing login in place instead of trying to create a second one.
   * Already the right kind of login, with no new credentials supplied?
   * This is a no-op -- it never rewrites a password nobody asked to change.
   */
  async syncLoginForEmployeeRole(
    employeeId: string,
    employeeRole: string,
    staffUsername?: string,
    staffPassword?: string,
    actorId?: string,
  ): Promise<void> {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');

    const wantsAdmin = employeeRole === 'ADMINISTRATOR';
    const existing = await this.prisma.user.findUnique({ where: { employeeId } });

    if (!existing) {
      if (wantsAdmin) {
        if (!staffUsername || !staffPassword) {
          throw new BadRequestException('Staff username and password are required when Employee Role is Administrator');
        }
        await this.create(
          {
            role: 'ADMIN' as any,
            username: staffUsername,
            fullName: employee.fullName,
            password: staffPassword,
            employeeId,
          },
          actorId,
        );
      } else {
        await this.create({ role: 'EMPLOYEE' as any, employeeId }, actorId);
      }
      return;
    }

    const existingIsStaffLogin = existing.role !== 'EMPLOYEE';
    if (wantsAdmin === existingIsStaffLogin) {
      // Already the right kind of login. Only touch it if HR explicitly
      // supplied fresh Administrator credentials to change.
      if (wantsAdmin && (staffUsername || staffPassword)) {
        await this.applyStaffCredentials(existing.id, employee.fullName, staffUsername, staffPassword, actorId);
      }
      return;
    }

    // Converting between an Employee ID login and a staff login for the
    // same employee -- update the existing row in place rather than create
    // a second, conflicting one (employeeId is unique per User).
    if (wantsAdmin) {
      if (!staffUsername || !staffPassword) {
        throw new BadRequestException('Staff username and password are required when Employee Role is Administrator');
      }
      await this.applyStaffCredentials(existing.id, employee.fullName, staffUsername, staffPassword, actorId, 'ADMIN');
    } else {
      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          role: 'EMPLOYEE',
          email: `${employee.employeeCode}@employee.smarthrm.local`,
          fullName: employee.fullName,
          passwordHash: await bcrypt.hash(employee.employeeCode, 10),
          mustChangePassword: true,
        },
      });
      await this.auditService.log({
        userId: actorId,
        action: 'USER_UPDATED',
        entity: 'User',
        entityId: existing.id,
        details: `Converted login for ${employee.fullName} (${employee.employeeCode}) to an Employee ID login (Employee Role changed)`,
      });
    }
  }

  // Shared by syncLoginForEmployeeRole's "update an existing staff login's
  // credentials" paths -- role is only passed (and only changed) when
  // converting an Employee ID login into a staff one.
  private async applyStaffCredentials(
    userId: string,
    fullName: string,
    staffUsername?: string,
    staffPassword?: string,
    actorId?: string,
    role?: string,
  ): Promise<void> {
    if (staffUsername) {
      const usernameTaken = await this.prisma.user.findUnique({ where: { email: staffUsername } });
      if (usernameTaken && usernameTaken.id !== userId) {
        throw new ConflictException('A user with this username already exists');
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(role ? { role: role as any } : {}),
        ...(staffUsername ? { email: staffUsername } : {}),
        fullName,
        ...(staffPassword ? { passwordHash: await bcrypt.hash(staffPassword, 10) } : {}),
      },
    });

    await this.auditService.log({
      userId: actorId,
      action: 'USER_UPDATED',
      entity: 'User',
      entityId: userId,
      details: role
        ? `Converted login for ${fullName} to an Administrator staff login (Employee Role changed)`
        : `Updated staff login credentials for ${fullName} (Employee Role)`,
    });
  }

  // 8 characters, unambiguous alphabet (no 0/O/1/I/l) so HR can read it
  // aloud or write it down for the employee without mixing up characters.
  private generateTempPassword(): string {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from(crypto.randomBytes(8))
      .map((b) => alphabet[b % alphabet.length])
      .join('');
  }

  async remove(id: string, actorId?: string) {
    await this.findOne(id);
    await this.prisma.user.delete({ where: { id } });

    await this.auditService.log({
      userId: actorId,
      action: 'USER_DELETED',
      entity: 'User',
      entityId: id,
    });

    return { success: true };
  }
}
