import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateGradeDto, UpdateGradeDto } from './dto/grade.dto';

@Injectable()
export class GradesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(dto: CreateGradeDto, actorId?: string) {
    const existing = await this.prisma.grade.findUnique({ where: { name: dto.name } });
    if (existing) throw new ConflictException('Grade name already exists');

    const grade = await this.prisma.grade.create({ data: dto });
    await this.auditService.log({
      userId: actorId,
      action: 'GRADE_CREATED',
      entity: 'Grade',
      entityId: grade.id,
      details: `Created grade ${grade.name}`,
    });
    return grade;
  }

  findAll() {
    return this.prisma.grade.findMany({
      orderBy: { level: 'asc' },
      include: { _count: { select: { designations: true } } },
    });
  }

  async findOne(id: string) {
    const grade = await this.prisma.grade.findUnique({
      where: { id },
      include: { _count: { select: { designations: true } } },
    });
    if (!grade) throw new NotFoundException('Grade not found');
    return grade;
  }

  async update(id: string, dto: UpdateGradeDto, actorId?: string) {
    await this.findOne(id);
    const grade = await this.prisma.grade.update({ where: { id }, data: dto });
    await this.auditService.log({
      userId: actorId,
      action: 'GRADE_UPDATED',
      entity: 'Grade',
      entityId: id,
    });
    return grade;
  }

  async remove(id: string, actorId?: string) {
    await this.findOne(id);
    await this.prisma.grade.delete({ where: { id } });
    await this.auditService.log({
      userId: actorId,
      action: 'GRADE_DELETED',
      entity: 'Grade',
      entityId: id,
    });
    return { success: true };
  }
}
