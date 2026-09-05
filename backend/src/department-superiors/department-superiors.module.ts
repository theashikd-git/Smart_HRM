import { Module } from '@nestjs/common';
import { DepartmentSuperiorsService } from './department-superiors.service';
import { DepartmentSuperiorsController } from './department-superiors.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [DepartmentSuperiorsService],
  controllers: [DepartmentSuperiorsController],
  exports: [DepartmentSuperiorsService],
})
export class DepartmentSuperiorsModule {}
