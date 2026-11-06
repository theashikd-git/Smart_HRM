import { Body, Controller, Delete, Get, Param, Patch, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RosterService } from './roster.service';
import { ApproveRosterAssignmentDto, RemoveRosterAssignmentDto, RosterQueryDto, UpsertRosterAssignmentDto } from './dto/roster.dto';

@ApiTags('Roster')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('roster')
export class RosterController {
  constructor(private service: RosterService) {}

  @Get()
  getWeek(@Query() query: RosterQueryDto) {
    return this.service.getWeek(query);
  }

  @Get('mine')
  getMine(@Query() query: RosterQueryDto, @CurrentUser() user: any) {
    return this.service.getMine(user.employeeId, query);
  }

  // MANAGER can assign/re-assign too now -- a Manager's own assignment
  // starts PENDING and waits for HR/Admin approval; the service blocks a
  // MANAGER from touching anything that's already APPROVED.
  @Put(':employeeId/:date')
  @Roles('ADMIN', 'HR', 'MANAGER')
  upsert(
    @Param('employeeId') employeeId: string,
    @Param('date') date: string,
    @Body() dto: UpsertRosterAssignmentDto,
    @CurrentUser() user: any,
  ) {
    return this.service.upsert(employeeId, date, dto, user.id, user.role);
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
  @Roles('ADMIN', 'HR', 'MANAGER')
  remove(
    @Param('employeeId') employeeId: string,
    @Param('date') date: string,
    @Body() dto: RemoveRosterAssignmentDto | undefined,
    @CurrentUser() user: any,
  ) {
    return this.service.remove(employeeId, date, dto, user.id, user.role);
  }
}
