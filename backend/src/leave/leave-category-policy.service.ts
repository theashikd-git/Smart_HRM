import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateLeaveCategoryPolicyDto, UpdateLeaveCategoryPolicyDto } from './dto/leave.dto';

@Injectable()
export class LeaveCategoryPolicyService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(dto: CreateLeaveCategoryPolicyDto, actorId?: string) {
    const leaveType = await this.prisma.leaveType.findUnique({ where: { id: dto.leaveTypeId } });
    if (!leaveType) throw new NotFoundException('Leave type not found');

    const existing = await this.prisma.leaveCategoryPolicy.findUnique({
      where: { leaveCategory_leaveTypeId: { leaveCategory: dto.leaveCategory, leaveTypeId: dto.leaveTypeId } },
    });
    if (existing) {
      throw new ConflictException(
        `A policy for ${dto.leaveCategory} + ${leaveType.name} already exists -- edit it instead of creating another`,
      );
    }

    const policy = await this.prisma.leaveCategoryPolicy.create({
      data: {
        leaveCategory: dto.leaveCategory,
        leaveTypeId: dto.leaveTypeId,
        daysPerCycle: dto.daysPerCycle,
        carryForward: dto.carryForward ?? false,
        maxCarryForwardDays: dto.maxCarryForwardDays,
        carryForwardOnce: dto.carryForwardOnce ?? false,
      },
      include: { leaveType: true },
    });

    await this.auditService.log({
      userId: actorId,
      action: 'LEAVE_CATEGORY_POLICY_CREATED',
      entity: 'LeaveCategoryPolicy',
      entityId: policy.id,
      details: `Set ${dto.leaveCategory} entitlement for ${leaveType.name} to ${dto.daysPerCycle} days`,
    });

    return policy;
  }

  findAll(leaveCategory?: string) {
    return this.prisma.leaveCategoryPolicy.findMany({
      where: leaveCategory ? { leaveCategory: leaveCategory as any } : undefined,
      include: { leaveType: true },
      orderBy: [{ leaveCategory: 'asc' }, { leaveType: { name: 'asc' } }],
    });
  }

  async findOne(id: string) {
    const policy = await this.prisma.leaveCategoryPolicy.findUnique({ where: { id }, include: { leaveType: true } });
    if (!policy) throw new NotFoundException('Leave category policy not found');
    return policy;
  }

  async update(id: string, dto: UpdateLeaveCategoryPolicyDto, actorId?: string) {
    await this.findOne(id);
    const policy = await this.prisma.leaveCategoryPolicy.update({
      where: { id },
      data: dto,
      include: { leaveType: true },
    });
    await this.auditService.log({
      userId: actorId,
      action: 'LEAVE_CATEGORY_POLICY_UPDATED',
      entity: 'LeaveCategoryPolicy',
      entityId: id,
    });
    return policy;
  }

  async remove(id: string, actorId?: string) {
    await this.findOne(id);
    await this.prisma.leaveCategoryPolicy.delete({ where: { id } });
    await this.auditService.log({
      userId: actorId,
      action: 'LEAVE_CATEGORY_POLICY_DELETED',
      entity: 'LeaveCategoryPolicy',
      entityId: id,
    });
    return { success: true };
  }
}
