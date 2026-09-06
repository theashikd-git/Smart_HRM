import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LeaveApprovalTierInput } from './dto/leave-workflow.dto';

@Injectable()
export class LeaveWorkflowService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /** Every department, with its configured approval chain (if any) -- for
   *  the admin tier-builder screen. Departments with no workflow yet still
   *  show up (with approvalWorkflow: null) so the admin can build one. */
  async findAll() {
    return this.prisma.department.findMany({
      select: {
        id: true,
        name: true,
        approvalWorkflow: {
          select: {
            id: true,
            isActive: true,
            tiers: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                order: true,
                label: true,
                type: true,
                approverUserId: true,
                approver: { select: { id: true, fullName: true, role: true } },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  private validateTiers(tiers: LeaveApprovalTierInput[]) {
    if (tiers.length === 0) throw new BadRequestException('At least one tier is required');
    const orders = tiers.map((t) => t.order);
    if (new Set(orders).size !== orders.length) {
      throw new BadRequestException('Tier order values must be unique');
    }
    for (const tier of tiers) {
      if (!tier.label?.trim()) throw new BadRequestException('Every tier needs a label');
      if (tier.type !== 'REPORTING_SUPERIOR' && tier.type !== 'SPECIFIC_USER') {
        throw new BadRequestException(`Invalid tier type: ${tier.type}`);
      }
      if (tier.type === 'SPECIFIC_USER' && !tier.approverUserId) {
        throw new BadRequestException(`Tier "${tier.label}" needs a person assigned`);
      }
    }
  }

  /** Full replace: delete this department's existing tiers and recreate
   *  from the given ordered list. Simplest correct way to let the admin
   *  screen freely add/remove/reorder tiers without diffing against what
   *  was there before. In-flight requests are unaffected structurally --
   *  LeaveRequest.currentTierOrder is a plain int, not a foreign key, so a
   *  request already mid-chain just falls back to ADMIN/HR-only override if
   *  its tier no longer exists after a save (see LeaveService). */
  async save(departmentId: string, tiers: LeaveApprovalTierInput[], isActive: boolean, actorId?: string) {
    const department = await this.prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) throw new NotFoundException('Department not found');
    this.validateTiers(tiers);

    const specificUserIds = [...new Set(tiers.filter((t) => t.type === 'SPECIFIC_USER').map((t) => t.approverUserId!))];
    if (specificUserIds.length > 0) {
      const users = await this.prisma.user.findMany({ where: { id: { in: specificUserIds } } });
      const found = new Set(users.map((u) => u.id));
      const missing = specificUserIds.filter((id) => !found.has(id));
      if (missing.length > 0) throw new BadRequestException('One or more assigned approvers no longer exist');
    }

    const workflow = await this.prisma.leaveApprovalWorkflow.upsert({
      where: { departmentId },
      update: { isActive },
      create: { departmentId, isActive },
    });

    await this.prisma.$transaction([
      this.prisma.leaveApprovalTier.deleteMany({ where: { workflowId: workflow.id } }),
      this.prisma.leaveApprovalTier.createMany({
        data: tiers.map((t) => ({
          workflowId: workflow.id,
          order: t.order,
          label: t.label.trim(),
          type: t.type,
          approverUserId: t.type === 'SPECIFIC_USER' ? t.approverUserId : null,
        })),
      }),
    ]);

    await this.auditService.log({
      userId: actorId,
      action: 'LEAVE_WORKFLOW_SAVED',
      entity: 'LeaveApprovalWorkflow',
      entityId: workflow.id,
      details: `${department.name}: ${tiers.length} tier(s), ${isActive ? 'active' : 'inactive'}`,
    });

    return this.prisma.leaveApprovalWorkflow.findUnique({
      where: { id: workflow.id },
      include: {
        tiers: {
          orderBy: { order: 'asc' },
          include: { approver: { select: { id: true, fullName: true, role: true } } },
        },
      },
    });
  }

  /** Reverts a department to the original simple flow (any ADMIN/HR/MANAGER
   *  may decide any request in it). */
  async remove(departmentId: string, actorId?: string) {
    const workflow = await this.prisma.leaveApprovalWorkflow.findUnique({ where: { departmentId } });
    if (!workflow) return { success: true };
    await this.prisma.leaveApprovalWorkflow.delete({ where: { id: workflow.id } });
    await this.auditService.log({
      userId: actorId,
      action: 'LEAVE_WORKFLOW_REMOVED',
      entity: 'LeaveApprovalWorkflow',
      entityId: workflow.id,
    });
    return { success: true };
  }
}
