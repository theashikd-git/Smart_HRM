import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateLeaveTypeDto, UpdateLeaveTypeDto } from './dto/leave.dto';

@Injectable()
export class LeaveTypesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(dto: CreateLeaveTypeDto, actorId?: string) {
    const existing = await this.prisma.leaveType.findFirst({
      where: { OR: [{ name: dto.name }, { code: dto.code }] },
    });
    if (existing) throw new ConflictException('A leave type with this name or code already exists');

    const leaveType = await this.prisma.leaveType.create({
      data: {
        name: dto.name,
        code: dto.code,
        daysPerYear: dto.daysPerYear ?? 0,
        paid: dto.paid ?? true,
        carryForward: dto.carryForward ?? false,
        maxCarryForwardDays: dto.maxCarryForwardDays,
        requiresApproval: dto.requiresApproval ?? true,
        color: dto.color,
      },
    });

    await this.auditService.log({
      userId: actorId,
      action: 'LEAVE_TYPE_CREATED',
      entity: 'LeaveType',
      entityId: leaveType.id,
      details: `Created leave type ${leaveType.name}`,
    });

    return leaveType;
  }

  findAll(includeInactive = false) {
    return this.prisma.leaveType.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const leaveType = await this.prisma.leaveType.findUnique({ where: { id } });
    if (!leaveType) throw new NotFoundException('Leave type not found');
    return leaveType;
  }

  async update(id: string, dto: UpdateLeaveTypeDto, actorId?: string) {
    await this.findOne(id);
    const leaveType = await this.prisma.leaveType.update({ where: { id }, data: dto });
    await this.auditService.log({
      userId: actorId,
      action: 'LEAVE_TYPE_UPDATED',
      entity: 'LeaveType',
      entityId: id,
    });
    return leaveType;
  }

  /**
   * Soft-delete only: leave types are referenced by historical balances and
   * requests, so a hard delete would either cascade-destroy years of leave
   * history or fail on the FK constraint. Deactivating hides it from new
   * requests/balance initialization while keeping past records intact.
   */
  async remove(id: string, actorId?: string) {
    await this.findOne(id);
    const leaveType = await this.prisma.leaveType.update({ where: { id }, data: { isActive: false } });
    await this.auditService.log({
      userId: actorId,
      action: 'LEAVE_TYPE_DEACTIVATED',
      entity: 'LeaveType',
      entityId: id,
    });
    return leaveType;
  }
}
