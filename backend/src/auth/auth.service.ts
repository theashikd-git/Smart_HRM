import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';
import { EmployeeLoginDto } from './dto/employee-login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private auditService: AuditService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string) {
    // The physical User table still stores the login identifier in its
    // `email` column (see UsersService.create), but the app now treats it as
    // a generic, non-email "username".
    const user = await this.prisma.user.findUnique({ where: { email: dto.username } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid username or password');
    }

    return this.issueSession(user, ipAddress);
  }

  /** Employee self-service login -- Employee ID as username, default password
   *  is that same Employee ID (see UsersService.create). Kept as a separate
   *  entry point from staff login rather than overloading LoginDto's username
   *  field, since the lookup path (Employee -> linked User) is different. */
  async employeeLogin(dto: EmployeeLoginDto, ipAddress?: string) {
    const employee = await this.prisma.employee.findUnique({ where: { employeeCode: dto.employeeCode } });
    if (!employee) {
      throw new UnauthorizedException('Invalid employee ID or password');
    }

    const user = await this.prisma.user.findUnique({ where: { employeeId: employee.id } });
    if (!user || !user.isActive || user.role !== 'EMPLOYEE') {
      throw new UnauthorizedException('Invalid employee ID or password');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid employee ID or password');
    }

    return this.issueSession(user, ipAddress);
  }

  private async issueSession(
    user: { id: string; email: string; fullName: string; role: string; mustChangePassword?: boolean },
    ipAddress?: string,
  ) {
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload = { sub: user.id, username: user.email, role: user.role };
    const accessToken = this.jwtService.sign(payload);

    await this.auditService.log({
      userId: user.id,
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      ipAddress,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        username: user.email,
        fullName: user.fullName,
        role: user.role,
        mustChangePassword: user.mustChangePassword ?? false,
      },
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        lastLoginAt: true,
        createdAt: true,
        employeeId: true,
        mustChangePassword: true,
      },
    });
    if (!user) return user;
    const { email, ...rest } = user;
    return { ...rest, username: email };
  }

  /** Self-service password change -- available to every role, but the one
   *  place it's actually mandatory is the employee portal, which blocks on
   *  this until mustChangePassword clears (see AppShellRoot/EmployeePortalView). */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Account not found');

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException('New password must be different from the current password');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });

    await this.auditService.log({
      userId,
      action: 'PASSWORD_CHANGED',
      entity: 'User',
      entityId: userId,
    });

    return { success: true };
  }

  async logout(userId: string, ipAddress?: string) {
    await this.auditService.log({
      userId,
      action: 'LOGOUT',
      entity: 'User',
      entityId: userId,
      ipAddress,
    });
    return { success: true };
  }
}
