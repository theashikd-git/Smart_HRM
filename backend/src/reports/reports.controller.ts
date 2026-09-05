import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  private sendCsv(res: Response, filename: string, rows: any[]) {
    const csv = this.reportsService.toCsv(this.reportsService.flatten(rows));
    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('daily-attendance')
  @Roles('ADMIN', 'HR', 'MANAGER')
  async dailyAttendance(@Query('date') date?: string, @Query('format') format?: string, @Res() res?: Response) {
    const data = await this.reportsService.dailyAttendance(date);
    if (format === 'csv') return this.sendCsv(res!, 'daily-attendance.csv', data);
    res!.json(data);
  }

  @Get('monthly-attendance')
  @Roles('ADMIN', 'HR', 'MANAGER')
  async monthlyAttendance(@Query('month') month?: string, @Query('format') format?: string, @Res() res?: Response) {
    const data = await this.reportsService.monthlyAttendance(month);
    if (format === 'csv') return this.sendCsv(res!, 'monthly-attendance.csv', data);
    res!.json(data);
  }

  @Get('employee-attendance')
  @Roles('ADMIN', 'HR', 'MANAGER')
  async employeeAttendance(
    @Query('employeeId') employeeId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('format') format?: string,
    @Res() res?: Response,
  ) {
    const data = await this.reportsService.employeeAttendance(employeeId, startDate, endDate);
    if (format === 'csv') return this.sendCsv(res!, 'employee-attendance.csv', data);
    res!.json(data);
  }

  @Get('late')
  @Roles('ADMIN', 'HR', 'MANAGER')
  async lateReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('format') format?: string,
    @Res() res?: Response,
  ) {
    const data = await this.reportsService.lateReport(startDate, endDate);
    if (format === 'csv') return this.sendCsv(res!, 'late-report.csv', data);
    res!.json(data);
  }

  @Get('overtime')
  @Roles('ADMIN', 'HR', 'MANAGER')
  async overtimeReport(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('format') format?: string,
    @Res() res?: Response,
  ) {
    const data = await this.reportsService.overtimeReport(startDate, endDate);
    if (format === 'csv') return this.sendCsv(res!, 'overtime-report.csv', data);
    res!.json(data);
  }

  @Get('department-attendance')
  @Roles('ADMIN', 'HR', 'MANAGER')
  async departmentAttendance(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('format') format?: string,
    @Res() res?: Response,
  ) {
    const data = await this.reportsService.departmentAttendanceReport(startDate, endDate);
    if (format === 'csv') return this.sendCsv(res!, 'department-attendance.csv', data);
    res!.json(data);
  }

  @Get('device-activity')
  @Roles('ADMIN', 'HR')
  async deviceActivity(@Query('format') format?: string, @Res() res?: Response) {
    const data = await this.reportsService.deviceActivity();
    if (format === 'csv') return this.sendCsv(res!, 'device-activity.csv', data);
    res!.json(data);
  }

  @Get('sync-history')
  @Roles('ADMIN', 'HR')
  async syncHistory(@Query('format') format?: string, @Res() res?: Response) {
    const data = await this.reportsService.syncHistoryReport();
    if (format === 'csv') return this.sendCsv(res!, 'sync-history.csv', data);
    res!.json(data);
  }

  @Get('audit-log')
  @Roles('ADMIN')
  async auditLog(@Query('format') format?: string, @Res() res?: Response) {
    const data = await this.reportsService.auditLogReport();
    if (format === 'csv') return this.sendCsv(res!, 'audit-log.csv', data);
    res!.json(data);
  }
}
