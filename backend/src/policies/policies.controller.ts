import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PoliciesService } from './policies.service';
import {
  ActivatePolicyDto,
  CreatePolicyDto,
  DeactivatePolicyDto,
  PolicyAbsenceQueryDto,
  UpdatePolicyDto,
} from './dto/policy.dto';

// Admin and HR manage policies; the Director can look but not change.
@ApiTags('Attendance policies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('policies')
export class PoliciesController {
  constructor(private service: PoliciesService) {}

  @Get()
  @Roles('ADMIN', 'HR', 'MANAGING_DIRECTOR')
  list() {
    return this.service.list();
  }

  // Policy absent days (reports, an employee's own attendance view). An
  // employee only ever sees their own.
  @Get('absences')
  absences(@Query() query: PolicyAbsenceQueryDto, @CurrentUser() user: any) {
    if (user.role === 'EMPLOYEE') {
      if (!user.employeeId) throw new ForbiddenException();
      query.employeeId = user.employeeId;
    }
    return this.service.listAbsences(query);
  }

  @Get('counters')
  @Roles('ADMIN', 'HR', 'MANAGING_DIRECTOR', 'MANAGER')
  counters(@Query('employeeId') employeeId: string, @Query('asOf') asOf?: string) {
    return this.service.countersFor(employeeId, asOf);
  }

  @Get(':id')
  @Roles('ADMIN', 'HR', 'MANAGING_DIRECTOR')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles('ADMIN', 'HR')
  create(@Body() dto: CreatePolicyDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'HR')
  update(@Param('id') id: string, @Body() dto: UpdatePolicyDto, @CurrentUser() user: any) {
    return this.service.update(id, dto, user.id);
  }

  @Post(':id/activate')
  @Roles('ADMIN', 'HR')
  activate(@Param('id') id: string, @Body() dto: ActivatePolicyDto, @CurrentUser() user: any) {
    return this.service.activate(id, dto, user.id);
  }

  @Post(':id/deactivate')
  @Roles('ADMIN', 'HR')
  deactivate(@Param('id') id: string, @Body() dto: DeactivatePolicyDto, @CurrentUser() user: any) {
    return this.service.deactivate(id, dto, user.id);
  }
}
