import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateLeaveCategoryPolicyDto,
  UpdateLeaveCategoryPolicyDto,
  QuickAddLeaveCategoryPolicyDto,
} from './dto/leave.dto';

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

  /**
   * Backs the Leave Policy screen's inline "+ Add Leave" under an
   * employee-category section -- HR types a leave name (e.g. "Casual") and
   * a day count directly, without a separate trip to the Leave Type screen
   * first. If a non-special-rule LeaveType with that name (case-insensitive)
   * already exists, it's reused; otherwise one is created on the fly with an
   * auto-generated unique code.
   */
  async quickAdd(dto: QuickAddLeaveCategoryPolicyDto, actorId?: string) {
    const name = dto.leaveName.trim();
    if (!name) throw new BadRequestException('Leave name is required');

    let leaveType = await this.prisma.leaveType.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, specialRule: 'NONE' },
    });

    let createdNewType = false;
    if (!leaveType) {
      const code = await this.generateCode(name);
      leaveType = await this.prisma.leaveType.create({
        data: {
          name,
          code,
          specialRule: 'NONE',
          daysPerYear: dto.daysPerCycle,
          carryForward: dto.carryForward ?? false,
          maxCarryForwardDays: dto.maxCarryForwardDays,
        },
      });
      createdNewType = true;

      await this.auditService.log({
        userId: actorId,
        action: 'LEAVE_TYPE_CREATED',
        entity: 'LeaveType',
        entityId: leaveType.id,
        details: `Created leave type "${name}" inline while setting up the ${dto.leaveCategory} leave policy`,
      });
    }

    const existing = await this.prisma.leaveCategoryPolicy.findUnique({
      where: { leaveCategory_leaveTypeId: { leaveCategory: dto.leaveCategory, leaveTypeId: leaveType.id } },
    });
    if (existing) {
      throw new ConflictException(
        `${leaveType.name} is already configured for ${dto.leaveCategory} -- edit it instead of adding it again`,
      );
    }

    const policy = await this.prisma.leaveCategoryPolicy.create({
      data: {
        leaveCategory: dto.leaveCategory,
        leaveTypeId: leaveType.id,
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
      details: `Set ${dto.leaveCategory} entitlement for ${leaveType.name} to ${dto.daysPerCycle} days${createdNewType ? ' (new leave type)' : ''}`,
    });

    return policy;
  }

  // Slugifies a leave name into an uppercase, underscore-separated code and
  // de-duplicates it against LeaveType's unique `code` column by appending a
  // numeric suffix -- e.g. "Casual Leave" -> CASUAL_LEAVE, and again ->
  // CASUAL_LEAVE_2.
  private async generateCode(name: string): Promise<string> {
    const base =
      name
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 30) || 'LEAVE';

    let code = base;
    let suffix = 1;
    while (await this.prisma.leaveType.findUnique({ where: { code } })) {
      suffix++;
      code = `${base}_${suffix}`;
    }
    return code;
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
