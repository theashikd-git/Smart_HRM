import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';
import { EmployeeLoginDto } from './dto/employee-login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private auditService: AuditService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueSession(user, ipAddress);
  }

  /** Employee self-service login -- Employee ID as username, default password
   *  is that same Employee ID (see UsersService.create). Kept as a separate
   *  entry point from staff login rather than overloading LoginDto's email
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

  private async issueSession(user: { id: string; email: string; fullName: string; role: string }, ipAddress?: string) {
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload = { sub: user.id, email: user.email, role: user.role };
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
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true, role: true, lastLoginAt: true, createdAt: true, employeeId: true },
    });
    return user;
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
