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

  // No @Roles here on purpose -- who may actually decide a given request is
  // no longer tied to the account's login role. It's enforced inside
  // LeaveService.checkTierAuthorization instead: ADMIN/HR can always
  // override, and otherwise only the specific person the current tier
  // resolves to (a System User, or whoever Superior Management names as the
  // department's Manager/Supervisor) is let through.
  @Patch('requests/:id/approve')
  approve(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.approve(id, user.id, user.role);
  }

  @Patch('requests/:id/reject')
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

  // No @Roles('EMPLOYEE') here on purpose, unlike the rest of this
  // self-service block -- My Calendar (originally Employee Portal-only) is
  // now also reused on the staff dashboard for a department head, so this
  // read stays open to any signed-in login and relies on assertLinkedEmployee
  // + the employeeId scoping below to keep it self-only, same as /roster/mine.
  @Get('my/requests')
  findMyRequests(@CurrentUser() user: any) {
    this.assertLinkedEmployee(user);
    return this.service.findAllForEmployee(user.employeeId);
  }

  // No @Roles('EMPLOYEE') on any route in this block, same reasoning as
  // findMyRequests above -- My Calendar and Apply Leave are now also used
  // from the Manager Portal (see ManagerDashboard), not just the Employee
  // Portal, so self-service leave stays open to any signed-in login. Every
  // route is still scoped strictly to the caller's own Employee record via
  // assertLinkedEmployee + user.employeeId, so this never lets one login
  // see or act on another's leave.

  // Requests currently awaiting a decision from THIS login specifically --
  // not scoped to the caller's own Employee record like the routes above,
  // since being a workflow approver is about the User account, not which
  // employee they are. Lets a login named as a SPECIFIC_USER approver (or
  // resolving as a REPORTING_SUPERIOR/department Manager) act on it here,
  // without needing the separate Leave module/staff approvals screen.
  @Get('my/approvals')
  findMyApprovals(@CurrentUser() user: any) {
    return this.service.findMyApprovals(user.id);
  }

  @Get('my/balances')
  findMyBalances(@CurrentUser() user: any, @Query('year') year?: string) {
    this.assertLinkedEmployee(user);
    return this.service.getBalances(user.employeeId, year ? parseInt(year, 10) : undefined);
  }

  // Only the leave types the signed-in employee is actually eligible for --
  // scoped to their own employee category's configured policy (plus the
  // special-rule types everyone can apply for) -- so the Apply for Leave
  // dropdown doesn't show entitlements from other categories.
  @Get('my/leave-types')
  findMyEligibleLeaveTypes(@CurrentUser() user: any) {
    this.assertLinkedEmployee(user);
    return this.service.getMyEligibleLeaveTypes(user.employeeId);
  }

  @Post('my/requests')
  createMyRequest(@Body() dto: SelfCreateLeaveRequestDto, @CurrentUser() user: any) {
    this.assertLinkedEmployee(user);
    return this.service.createForSelf(user.employeeId, user.id, dto);
  }

  @Patch('my/requests/:id/cancel')
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
