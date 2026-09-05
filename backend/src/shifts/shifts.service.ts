import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateShiftDto, UpdateShiftDto } from './dto/shift.dto';

@Injectable()
export class ShiftsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(dto: CreateShiftDto, actorId?: string) {
    const shift = await this.prisma.shift.create({ data: dto });
    await this.auditService.log({
      userId: actorId,
      action: 'SHIFT_CREATED',
      entity: 'Shift',
      entityId: shift.id,
    });
    return shift;
  }

  findAll() {
    return this.prisma.shift.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { employees: true } } },
    });
  }

  async findOne(id: string) {
    const shift = await this.prisma.shift.findUnique({ where: { id } });
    if (!shift) throw new NotFoundException('Shift not found');
    return shift;
  }

  async update(id: string, dto: UpdateShiftDto, actorId?: string) {
    await this.findOne(id);
    const shift = await this.prisma.shift.update({ where: { id }, data: dto });
    await this.auditService.log({
      userId: actorId,
      action: 'SHIFT_UPDATED',
      entity: 'Shift',
      entityId: id,
    });
    return shift;
  }

  async remove(id: string, actorId?: string) {
    await this.findOne(id);
    await this.prisma.shift.delete({ where: { id } });
    await this.auditService.log({
      userId: actorId,
      action: 'SHIFT_DELETED',
      entity: 'Shift',
      entityId: id,
    });
    return { success: true };
  }
}
