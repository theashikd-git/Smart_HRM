import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateHolidayDto, UpdateHolidayDto } from './dto/holiday.dto';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class HolidaysService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(dto: CreateHolidayDto, actorId?: string) {
    const date = startOfDay(new Date(dto.date));
    const existing = await this.prisma.holiday.findUnique({ where: { date } });
    if (existing) throw new ConflictException('A holiday is already declared on this date');

    const holiday = await this.prisma.holiday.create({
      data: { name: dto.name, date, type: dto.type },
    });
    await this.auditService.log({
      userId: actorId,
      action: 'HOLIDAY_CREATED',
      entity: 'Holiday',
      entityId: holiday.id,
    });
    return holiday;
  }

  findAll() {
    return this.prisma.holiday.findMany({ orderBy: { date: 'asc' } });
  }

  async findOne(id: string) {
    const holiday = await this.prisma.holiday.findUnique({ where: { id } });
    if (!holiday) throw new NotFoundException('Holiday not found');
    return holiday;
  }

  async update(id: string, dto: UpdateHolidayDto, actorId?: string) {
    await this.findOne(id);
    const data: { name?: string; date?: Date; type?: string } = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.date !== undefined) data.date = startOfDay(new Date(dto.date));
    if (dto.type !== undefined) data.type = dto.type;

    if (data.date) {
      const clash = await this.prisma.holiday.findUnique({ where: { date: data.date } });
      if (clash && clash.id !== id) throw new ConflictException('A holiday is already declared on this date');
    }

    const holiday = await this.prisma.holiday.update({ where: { id }, data });
    await this.auditService.log({
      userId: actorId,
      action: 'HOLIDAY_UPDATED',
      entity: 'Holiday',
      entityId: id,
    });
    return holiday;
  }

  async remove(id: string, actorId?: string) {
    await this.findOne(id);
    await this.prisma.holiday.delete({ where: { id } });
    await this.auditService.log({
      userId: actorId,
      action: 'HOLIDAY_DELETED',
      entity: 'Holiday',
      entityId: id,
    });
    return { success: true };
  }

  /** Is `date` a declared holiday? Used by AttendanceService (so a punch on
   *  a holiday still records status=HOLIDAY) and DashboardService (so an
   *  employee with no punch on a holiday shows as HOLIDAY, not ABSENT). */
  async isHoliday(date: Date): Promise<boolean> {
    const holiday = await this.prisma.holiday.findUnique({ where: { date: startOfDay(date) } });
    return !!holiday;
  }
}
