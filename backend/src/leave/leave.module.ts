import { Module } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { LeaveTypesService } from './leave-types.service';
import { LeaveController } from './leave.controller';
import { LeaveTypesController } from './leave-types.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [LeaveService, LeaveTypesService],
  controllers: [LeaveController, LeaveTypesController],
  exports: [LeaveService, LeaveTypesService],
})
export class LeaveModule {}
