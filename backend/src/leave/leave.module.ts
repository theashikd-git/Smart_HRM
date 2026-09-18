import { Module } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { LeaveTypesService } from './leave-types.service';
import { LeaveWorkflowService } from './leave-workflow.service';
import { LeaveCategoryPolicyService } from './leave-category-policy.service';
import { LeaveSchedulerService } from './leave-scheduler.service';
import { LeaveAttachmentsService } from './leave-attachments.service';
import { EmployeeCategoriesService } from './employee-categories.service';
import { LeaveController } from './leave.controller';
import { LeaveTypesController } from './leave-types.controller';
import { LeaveWorkflowController } from './leave-workflow.controller';
import { LeaveCategoryPolicyController } from './leave-category-policy.controller';
import { LeaveAttachmentsController } from './leave-attachments.controller';
import { EmployeeCategoriesController } from './employee-categories.controller';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [AuditModule, NotificationsModule],
  providers: [
    LeaveService,
    LeaveTypesService,
    LeaveWorkflowService,
    LeaveCategoryPolicyService,
    LeaveSchedulerService,
    LeaveAttachmentsService,
    EmployeeCategoriesService,
  ],
  controllers: [
    LeaveController,
    LeaveTypesController,
    LeaveWorkflowController,
    LeaveCategoryPolicyController,
    LeaveAttachmentsController,
    EmployeeCategoriesController,
  ],
  exports: [LeaveService, LeaveTypesService, LeaveWorkflowService, LeaveCategoryPolicyService, EmployeeCategoriesService],
})
export class LeaveModule {}
