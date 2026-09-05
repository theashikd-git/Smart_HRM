import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateLocationDto, UpdateLocationDto } from './dto/location.dto';

@Injectable()
export class LocationsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(dto: CreateLocationDto, actorId?: string) {
    const location = await this.prisma.location.create({ data: dto });
    await this.auditService.log({
      userId: actorId,
      action: 'LOCATION_CREATED',
      entity: 'Location',
      entityId: location.id,
      details: `Created location ${location.name}`,
    });
    return location;
  }

  findAll() {
    return this.prisma.location.findMany({
      orderBy: { name: 'asc' },
      include: {
        branch: { select: { id: true, name: true } },
        _count: { select: { employees: true, departments: true } },
      },
    });
  }

  async findOne(id: string) {
    const location = await this.prisma.location.findUnique({
      where: { id },
      include: {
        branch: { select: { id: true, name: true } },
        _count: { select: { employees: true, departments: true } },
      },
    });
    if (!location) throw new NotFoundException('Location not found');
    return location;
  }

  async update(id: string, dto: UpdateLocationDto, actorId?: string) {
    await this.findOne(id);
    const location = await this.prisma.location.update({ where: { id }, data: dto });
    await this.auditService.log({
      userId: actorId,
      action: 'LOCATION_UPDATED',
      entity: 'Location',
      entityId: id,
    });
    return location;
  }

  async remove(id: string, actorId?: string) {
    await this.findOne(id);
    await this.prisma.location.delete({ where: { id } });
    await this.auditService.log({
      userId: actorId,
      action: 'LOCATION_DELETED',
      entity: 'Location',
      entityId: id,
    });
    return { success: true };
  }
}
