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
   */
  async resetPasswordByEmployeeId(employeeId: string, actorId?: string) {
    const user = await this.prisma.user.findUnique({ where: { employeeId } });
    if (!user || user.role !== 'EMPLOYEE') {
      throw new NotFoundException('This employee does not have a self-service login yet');
    }

    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: true },
    });

    await this.auditService.log({
      userId: actorId,
      action: 'USER_PASSWORD_RESET',
      entity: 'User',
      entityId: user.id,
      details: `Password reset for employee login ${user.email}`,
    });

    return { tempPassword };
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
