import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateShiftDto, UpdateShiftDto } from './dto/shift.dto';

const DEPARTMENT_SELECT = { select: { id: true, name: true } };

@Injectable()
export class ShiftsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /**
   * Which department(s) this actor may SEE shifts for. Shifts are created
   * and managed only by HR/Admin (department-wise); a MANAGER/SUPERVISOR
   * just picks from them when assigning duty on the Roster, so they only
   * see their own department's shifts plus General (department-less) ones.
   * - null  = unrestricted (ADMIN/HR/MANAGING_DIRECTOR/EMPLOYEE).
   * - [...] = restricted to exactly these department ids ([] if tied to
   *   none). A MANAGER is scoped to the department(s) they head
   *   (Department.headEmployeeId); a SUPERVISOR to the department their own
   *   employee record belongs to.
   */
  private async resolveActorDepartmentIds(
    actorRole?: string,
    actorEmployeeId?: string | null,
  ): Promise<string[] | null> {
    if (actorRole !== 'MANAGER' && actorRole !== 'SUPERVISOR') return null;
    if (!actorEmployeeId) return [];

    if (actorRole === 'MANAGER') {
      const led = await this.prisma.department.findMany({
        where: { headEmployeeId: actorEmployeeId },
        select: { id: true },
      });
      return led.map((d) => d.id);
    }

    // SUPERVISOR
    const employee = await this.prisma.employee.findUnique({
      where: { id: actorEmployeeId },
      select: { departmentId: true },
    });
    return employee?.departmentId ? [employee.departmentId] : [];
  }

  async create(dto: CreateShiftDto, actorId?: string) {
    if (!dto.departmentId) {
      throw new BadRequestException('Select the department this shift belongs to.');
    }
    const department = await this.prisma.department.findUnique({ where: { id: dto.departmentId }, select: { id: true } });
    if (!department) throw new NotFoundException('Department not found');

    const shift = await this.prisma.shift.create({
      data: dto,
      include: { department: DEPARTMENT_SELECT },
    });
    await this.auditService.log({
      userId: actorId,
      action: 'SHIFT_CREATED',
      entity: 'Shift',
      entityId: shift.id,
    });
    return shift;
  }

  async findAll(actorRole?: string, actorEmployeeId?: string | null) {
    const allowed = await this.resolveActorDepartmentIds(actorRole, actorEmployeeId);
    const where = allowed === null ? {} : { OR: [{ departmentId: null }, { departmentId: { in: allowed } }] };

    return this.prisma.shift.findMany({
      where,
      orderBy: { name: 'asc' },
      include: { _count: { select: { employees: true } }, department: DEPARTMENT_SELECT },
    });
  }

  async findOne(id: string) {
    const shift = await this.prisma.shift.findUnique({
      where: { id },
      include: { department: DEPARTMENT_SELECT },
    });
    if (!shift) throw new NotFoundException('Shift not found');
    return shift;
  }

  async update(id: string, dto: UpdateShiftDto, actorId?: string) {
    await this.findOne(id);
    const shift = await this.prisma.shift.update({
      where: { id },
      data: dto,
      include: { department: DEPARTMENT_SELECT },
    });
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
