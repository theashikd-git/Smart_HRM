import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RosterService } from './roster.service';
import {
  ApproveRosterAssignmentDto,
  BatchRosterDto,
  RemoveRosterAssignmentDto,
  RosterQueryDto,
  UpsertRosterAssignmentDto,
} from './dto/roster.dto';

@ApiTags('Roster')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('roster')
export class RosterController {
  constructor(private service: RosterService) {}

  @Get()
  getWeek(@Query() query: RosterQueryDto, @CurrentUser() user: any) {
    return this.service.getWeek(query, user.role, user.employeeId);
  }

  @Get('mine')
  getMine(@Query() query: RosterQueryDto, @CurrentUser() user: any) {
    return this.service.getMine(user.employeeId, query);
  }

  // No @Roles -- same openness as leave's own pending-count (a read-only
  // dashboard badge, not an action), so it works for whichever role lands
  // on the Admin/HR dashboard (ADMIN, HR, or Managing Director).
  @Get('pending-count')
  pendingCount() {
    return this.service.pendingCount();
  }

  // Save a whole staged batch of roster edits (assign / day off / clear)
  // from the Roster screen in one request. Each change follows exactly the
  // same rules as the single-cell endpoints below -- see
  // RosterService.batchApply.
  @Post('batch')
  @Roles('ADMIN', 'HR', 'MANAGER', 'SUPERVISOR')
  batch(@Body() dto: BatchRosterDto, @CurrentUser() user: any) {
    return this.service.batchApply(dto, user.id, user.role, user.employeeId);
  }

  // MANAGER/SUPERVISOR can assign/re-assign too -- their own assignment
  // starts PENDING and waits for HR/Admin approval; the service blocks
  // either role from touching anything that's already APPROVED, and from
  // assigning duty to an employee outside their own department.
  @Put(':employeeId/:date')
  @Roles('ADMIN', 'HR', 'MANAGER', 'SUPERVISOR')
  upsert(
    @Param('employeeId') employeeId: string,
    @Param('date') date: string,
    @Body() dto: UpsertRosterAssignmentDto,
    @CurrentUser() user: any,
  ) {
    return this.service.upsert(employeeId, date, dto, user.id, user.role, user.employeeId);
  }

  @Patch(':employeeId/:date/approve')
  @Roles('ADMIN', 'HR')
  approve(
    @Param('employeeId') employeeId: string,
    @Param('date') date: string,
    @Body() dto: ApproveRosterAssignmentDto | undefined,
    @CurrentUser() user: any,
  ) {
    return this.service.approve(employeeId, date, dto ?? {}, user.id);
  }

  @Delete(':employeeId/:date')
  @Roles('ADMIN', 'HR', 'MANAGER', 'SUPERVISOR')
  remove(
    @Param('employeeId') employeeId: string,
    @Param('date') date: string,
    @Body() dto: RemoveRosterAssignmentDto | undefined,
    @CurrentUser() user: any,
  ) {
    return this.service.remove(employeeId, date, dto, user.id, user.role, user.employeeId);
  }
}
