import { Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LeaveWorkflowService } from './leave-workflow.service';
import { SaveLeaveWorkflowDto } from './dto/leave-workflow.dto';

/** ADMIN-only: configure each department's leave approval chain (the "tiers"
 *  a request must pass through -- e.g. Supervisor -> Department Manager ->
 *  HR Admin -> Director Medical Services). A department with no workflow
 *  configured keeps the original simple flow (any ADMIN/HR/MANAGER decides
 *  any request), so this can be rolled out one department at a time. */
@ApiTags('Leave Approval Workflows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leave/workflows')
export class LeaveWorkflowController {
  constructor(private service: LeaveWorkflowService) {}

  @Get()
  @Roles('ADMIN')
  findAll() {
    return this.service.findAll();
  }

  @Put(':departmentId')
  @Roles('ADMIN')
  save(@Param('departmentId') departmentId: string, @Body() dto: SaveLeaveWorkflowDto, @CurrentUser() user: any) {
    return this.service.save(departmentId, dto.tiers, dto.isActive ?? true, user.id);
  }

  @Delete(':departmentId')
  @Roles('ADMIN')
  remove(@Param('departmentId') departmentId: string, @CurrentUser() user: any) {
    return this.service.remove(departmentId, user.id);
  }
}
