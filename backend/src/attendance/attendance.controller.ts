import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AttendanceService } from './attendance.service';
import {
  AttendanceQueryDto,
  ApproveAttendanceDto,
  CorrectAttendanceDto,
  ManualPunchDto,
} from './dto/attendance.dto';

@ApiTags('Attendance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  @Post('sync')
  @Roles('ADMIN', 'HR')
  sync(@CurrentUser() user: any) {
    return this.attendanceService.syncFromDevice(user.id);
  }

  @Post('manual-punch')
  @Roles('ADMIN', 'HR')
  manualPunch(@Body() dto: ManualPunchDto, @CurrentUser() user: any) {
    return this.attendanceService.manualPunch(dto, user.id);
  }

  @Get()
  findAll(@Query() query: AttendanceQueryDto) {
    return this.attendanceService.findAll(query);
  }

  @Get('missing-punches')
  missingPunches() {
    return this.attendanceService.missingPunches();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.attendanceService.findOne(id);
  }

  @Patch(':id/correct')
  @Roles('ADMIN', 'HR')
  correct(@Param('id') id: string, @Body() dto: CorrectAttendanceDto, @CurrentUser() user: any) {
    return this.attendanceService.correct(id, dto, user.id);
  }

  @Patch(':id/approve')
  @Roles('ADMIN', 'HR')
  approve(@Param('id') id: string, @Body() dto: ApproveAttendanceDto, @CurrentUser() user: any) {
    return this.attendanceService.approve(id, dto, user.id);
  }
}
