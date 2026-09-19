import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LeaveService } from './leave.service';
import {
  CreateLeaveCategoryPolicyDto,
  UpdateLeaveCategoryPolicyDto,
  QuickAddLeaveCategoryPolicyDto,
} from './dto/leave.dto';

@Injectable()
export class LeaveCategoryPolicyService {
  private readonly logger = new Logger(LeaveCategoryPolicyService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    private leaveService: LeaveService,
  ) {}

  // A new policy row (e.g. "Permanent gets 16 days Annual Leave") only
  // describes the entitlement -- the actual LeaveBalance rows employees'
  // portals read from don't exist until initializeBalances runs. Without
  // this, every employee already in that category keeps showing "0 day(s)
  // remaining" for the newly-configured leave until someone happens to
  // re-run initialization by hand. Scoped to this one leave type, so it
  // only ever creates rows for employees who don't have one yet this year.
  private async backfillBalancesFor(leaveTypeId: string, actorId?: string) {
    await this.leaveService.initializeBalances({ leaveTypeId }, actorId).catch((err: any) => {
      this.logger.error(`Failed to backfill leave balances for leave type ${leaveTypeId}: ${err?.message ?? err}`);
    });
  }

  async create(dto: CreateLeaveCategoryPolicyDto, actorId?: string) {
    const category = await this.prisma.employeeCategory.findUnique({ where: { id: dto.leaveCategoryId } });
    if (!category) throw new NotFoundException('Employee category not found');

    const leaveType = await this.prisma.leaveType.findUnique({ where: { id: dto.leaveTypeId } });
    if (!leaveType) throw new NotFoundException('Leave type not found');

    const existing = await this.prisma.leaveCategoryPolicy.findUnique({
      where: { leaveCategoryId_leaveTypeId: { leaveCategoryId: dto.leaveCategoryId, leaveTypeId: dto.leaveTypeId } },
    });
    if (existing) {
      throw new ConflictException(
        `A policy for ${category.name} + ${leaveType.name} already exists -- edit it instead of creating another`,
      );
    }

    const policy = await this.prisma.leaveCategoryPolicy.create({
      data: {
        leaveCategoryId: dto.leaveCategoryId,
        leaveTypeId: dto.leaveTypeId,
        daysPerCycle: dto.daysPerCycle,
        carryForward: dto.carryForward ?? false,
        maxCarryForwardDays: dto.maxCarryForwardDays,
        carryForwardOnce: dto.carryForwardOnce ?? false,
      },
      include: { leaveType: true, leaveCategory: true },
    });

    await this.auditService.log({
      userId: actorId,
      action: 'LEAVE_CATEGORY_POLICY_CREATED',
      entity: 'LeaveCategoryPolicy',
      entityId: policy.id,
      details: `Set ${category.name} entitlement for ${leaveType.name} to ${dto.daysPerCycle} days`,
    });

    await this.backfillBalancesFor(leaveType.id, actorId);

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
    const category = await this.prisma.employeeCategory.findUnique({ where: { id: dto.leaveCategoryId } });
    if (!category) throw new NotFoundException('Employee category not found');

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
        details: `Created leave type "${name}" inline while setting up the ${category.name} leave policy`,
      });
    }

    const existing = await this.prisma.leaveCategoryPolicy.findUnique({
      where: { leaveCategoryId_leaveTypeId: { leaveCategoryId: dto.leaveCategoryId, leaveTypeId: leaveType.id } },
    });
    if (existing) {
      throw new ConflictException(
        `${leaveType.name} is already configured for ${category.name} -- edit it instead of adding it again`,
      );
    }

    const policy = await this.prisma.leaveCategoryPolicy.create({
      data: {
        leaveCategoryId: dto.leaveCategoryId,
        leaveTypeId: leaveType.id,
        daysPerCycle: dto.daysPerCycle,
        carryForward: dto.carryForward ?? false,
        maxCarryForwardDays: dto.maxCarryForwardDays,
        carryForwardOnce: dto.carryForwardOnce ?? false,
      },
      include: { leaveType: true, leaveCategory: true },
    });

    await this.auditService.log({
      userId: actorId,
      action: 'LEAVE_CATEGORY_POLICY_CREATED',
      entity: 'LeaveCategoryPolicy',
      entityId: policy.id,
      details: `Set ${category.name} entitlement for ${leaveType.name} to ${dto.daysPerCycle} days${createdNewType ? ' (new leave type)' : ''}`,
    });

    await this.backfillBalancesFor(leaveType.id, actorId);

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

  findAll(leaveCategoryId?: string) {
    return this.prisma.leaveCategoryPolicy.findMany({
      where: leaveCategoryId ? { leaveCategoryId } : undefined,
      include: { leaveType: true, leaveCategory: true },
      orderBy: [{ leaveCategory: { name: 'asc' } }, { leaveType: { name: 'asc' } }],
    });
  }

  async findOne(id: string) {
    const policy = await this.prisma.leaveCategoryPolicy.findUnique({
      where: { id },
      include: { leaveType: true, leaveCategory: true },
    });
    if (!policy) throw new NotFoundException('Leave category policy not found');
    return policy;
  }

  async update(id: string, dto: UpdateLeaveCategoryPolicyDto, actorId?: string) {
    await this.findOne(id);
    const policy = await this.prisma.leaveCategoryPolicy.update({
      where: { id },
      data: dto,
      include: { leaveType: true, leaveCategory: true },
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
