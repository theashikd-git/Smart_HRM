import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
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
