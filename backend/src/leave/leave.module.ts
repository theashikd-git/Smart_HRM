import { Module } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { LeaveTypesService } from './leave-types.service';
import { LeaveWorkflowService } from './leave-workflow.service';
import { LeaveController } from './leave.controller';
import { LeaveTypesController } from './leave-types.controller';
import { LeaveWorkflowController } from './leave-workflow.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [LeaveService, LeaveTypesService, LeaveWorkflowService],
  controllers: [LeaveController, LeaveTypesController, LeaveWorkflowController],
  exports: [LeaveService, LeaveTypesService, LeaveWorkflowService],
})
export class LeaveModule {}
