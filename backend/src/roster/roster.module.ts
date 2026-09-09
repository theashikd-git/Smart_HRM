import { Module } from '@nestjs/common';
import { RosterService } from './roster.service';
import { RosterController } from './roster.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  providers: [RosterService],
  controllers: [RosterController],
  exports: [RosterService],
})
export class RosterModule {}
