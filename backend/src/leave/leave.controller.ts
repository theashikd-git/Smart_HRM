import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LeaveService } from './leave.service';
import {
  AdjustLeaveBalanceDto,
  CreateLeaveRequestDto,
  InitializeBalancesDto,
  LeaveQueryDto,
  RejectLeaveRequestDto,
} from './dto/leave.dto';
import { SelfCreateLeaveRequestDto } from './dto/self-leave-request.dto';

@ApiTags('Leave')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leave')
export class LeaveController {
  constructor(private service: LeaveService) {}

  // -- Requests -----------------------------------------------------------

  @Post('requests')
  @Roles('ADMIN', 'HR', 'MANAGER')
  createRequest(@Body() dto: CreateLeaveRequestDto, @CurrentUser() user: any) {
    // Only ADMIN/HR may bypass the remaining-balance check; a MANAGER's
    // overrideBalance flag (if sent) is silently ignored rather than
    // trusted from the request body.
    const canOverride = user.role === 'ADMIN' || user.role === 'HR';
    return this.service.create(
      { ...dto, overrideBalance: canOverride ? dto.overrideBalance : false },
      user.id,
    );
  }

  @Get('requests')
  findAllRequests(@Query() query: LeaveQueryDto) {
    return this.service.findAll(query);
  }

  @Get('requests/:id')
  findOneRequest(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch('requests/:id/approve')
  @Roles('ADMIN', 'HR', 'MANAGER', 'SUPERVISOR')
  approve(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.approve(id, user.id, user.role);
  }

  @Patch('requests/:id/reject')
  @Roles('ADMIN', 'HR', 'MANAGER', 'SUPERVISOR')
  reject(@Param('id') id: string, @Body() dto: RejectLeaveRequestDto, @CurrentUser() user: any) {
    return this.service.reject(id, dto, user.id, user.role);
  }

  @Patch('requests/:id/cancel')
  @Roles('ADMIN', 'HR', 'MANAGER')
  cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.cancel(id, user.id);
  }

  // -- Balances -------------------------------------------------------------

  @Get('balances/:employeeId')
  getBalances(@Param('employeeId') employeeId: string, @Query('year') year?: string) {
    return this.service.getBalances(employeeId, year ? parseInt(year, 10) : undefined);
  }

  @Post('balances/adjust')
  @Roles('ADMIN', 'HR')
  adjustBalance(@Body() dto: AdjustLeaveBalanceDto, @CurrentUser() user: any) {
    return this.service.adjustBalance(dto, user.id);
  }

  @Post('balances/initialize')
  @Roles('ADMIN', 'HR')
  initializeBalances(@Body() dto: InitializeBalancesDto, @CurrentUser() user: any) {
    return this.service.initializeBalances(dto, user.id);
  }

  // -- Misc -----------------------------------------------------------------

  @Get('calendar')
  calendar(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.service.calendar(from, to, departmentId);
  }

  @Get('pending-count')
  pendingCount() {
    return this.service.pendingCount();
  }

  // -- Employee self-service (Employee portal) ------------------------------
  // Every route below is scoped strictly to the caller's OWN Employee record
  // (via their linked User.employeeId) -- never trusts an employeeId from
  // the request body/query, so one employee's login can never see or act on
  // another's leave.

  @Get('my/requests')
  @Roles('EMPLOYEE')
  findMyRequests(@CurrentUser() user: any) {
    this.assertLinkedEmployee(user);
    return this.service.findAllForEmployee(user.employeeId);
  }

  @Get('my/balances')
  @Roles('EMPLOYEE')
  findMyBalances(@CurrentUser() user: any, @Query('year') year?: string) {
    this.assertLinkedEmployee(user);
    return this.service.getBalances(user.employeeId, year ? parseInt(year, 10) : undefined);
  }

  @Post('my/requests')
  @Roles('EMPLOYEE')
  createMyRequest(@Body() dto: SelfCreateLeaveRequestDto, @CurrentUser() user: any) {
    this.assertLinkedEmployee(user);
    return this.service.createForSelf(user.employeeId, user.id, dto);
  }

  @Patch('my/requests/:id/cancel')
  @Roles('EMPLOYEE')
  cancelMyRequest(@Param('id') id: string, @CurrentUser() user: any) {
    this.assertLinkedEmployee(user);
    return this.service.cancelOwn(user.employeeId, id, user.id);
  }

  private assertLinkedEmployee(user: any) {
    if (!user.employeeId) {
      throw new BadRequestException('This login is not linked to an Employee record');
    }
  }
}
