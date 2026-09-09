import { Body, Controller, Delete, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RosterService } from './roster.service';
import { RosterQueryDto, UpsertRosterAssignmentDto } from './dto/roster.dto';

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

  @Put(':employeeId/:date')
  @Roles('ADMIN', 'HR')
  upsert(
    @Param('employeeId') employeeId: string,
    @Param('date') date: string,
    @Body() dto: UpsertRosterAssignmentDto,
    @CurrentUser() user: any,
  ) {
    return this.service.upsert(employeeId, date, dto, user.id);
  }

  @Delete(':employeeId/:date')
  @Roles('ADMIN', 'HR')
  remove(@Param('employeeId') employeeId: string, @Param('date') date: string, @CurrentUser() user: any) {
    return this.service.remove(employeeId, date, user.id);
  }
}
