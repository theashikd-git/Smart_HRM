import { Module } from '@nestjs/common';
import { SubDepartmentsService } from './sub-departments.service';
import { SubDepartmentsController } from './sub-departments.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [SubDepartmentsService],
  controllers: [SubDepartmentsController],
  exports: [SubDepartmentsService],
})
export class SubDepartmentsModule {}
