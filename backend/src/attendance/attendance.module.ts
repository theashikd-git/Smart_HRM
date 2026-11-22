import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { AuditModule } from '../audit/audit.module';
import { DevicesModule } from '../devices/devices.module';
import { HolidaysModule } from '../holidays/holidays.module';
import { PoliciesModule } from '../policies/policies.module';

@Module({
  imports: [AuditModule, DevicesModule, HolidaysModule, PoliciesModule],
  providers: [AttendanceService],
  controllers: [AttendanceController],
  exports: [AttendanceService],
})
export class AttendanceModule {}
