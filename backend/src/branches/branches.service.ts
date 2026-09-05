import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

@Injectable()
export class BranchesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(dto: CreateBranchDto, actorId?: string) {
    const existing = await this.prisma.branch.findUnique({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Branch code already exists');

    const branch = await this.prisma.branch.create({ data: dto });
    await this.auditService.log({
      userId: actorId,
      action: 'BRANCH_CREATED',
      entity: 'Branch',
      entityId: branch.id,
      details: `Created branch ${branch.name}`,
    });
    return branch;
  }

  findAll() {
    return this.prisma.branch.findMany({
      orderBy: { name: 'asc' },
      include: {
        manager: { select: { id: true, fullName: true } },
        _count: { select: { employees: true, departments: true, locations: true } },
      },
    });
  }

  async findOne(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      include: {
        manager: { select: { id: true, fullName: true } },
        _count: { select: { employees: true, departments: true, locations: true } },
      },
    });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async update(id: string, dto: UpdateBranchDto, actorId?: string) {
    await this.findOne(id);
    const branch = await this.prisma.branch.update({ where: { id }, data: dto });
    await this.auditService.log({
      userId: actorId,
      action: 'BRANCH_UPDATED',
      entity: 'Branch',
      entityId: id,
    });
    return branch;
  }

  async remove(id: string, actorId?: string) {
    await this.findOne(id);
    await this.prisma.branch.delete({ where: { id } });
    await this.auditService.log({
      userId: actorId,
      action: 'BRANCH_DELETED',
      entity: 'Branch',
      entityId: id,
    });
    return { success: true };
  }
}
