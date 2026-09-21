import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('summary')
  summary() {
    return this.dashboardService.summary();
  }

  // Any signed-in user can call this -- it's self-scoped by their own user
  // id and simply comes back empty unless they're set as a department's
  // head (see DashboardService.myTeamAttendance for why that's the check,
  // not their Role).
  @Get('my-team-attendance')
  myTeamAttendance(@CurrentUser() user: any) {
    return this.dashboardService.myTeamAttendance(user.id);
  }

  @Get('weekly-attendance')
  weeklyAttendance() {
    return this.dashboardService.weeklyAttendance();
  }

  @Get('department-attendance')
  departmentAttendance() {
    return this.dashboardService.departmentAttendance();
  }

  @Get('employee-growth')
  employeeGrowth() {
    return this.dashboardService.employeeGrowth();
  }
}
