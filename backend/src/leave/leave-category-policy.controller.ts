import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LeaveCategoryPolicyService } from './leave-category-policy.service';
import { CreateLeaveCategoryPolicyDto, UpdateLeaveCategoryPolicyDto } from './dto/leave.dto';

// Admin-configurable entitlements for each (employee category, leave type)
// pair -- e.g. Permanent/Casual = 10 days, Provision/Sick = 7 days, per the
// HR-provided leave policy spec. LeaveService's balance allocator reads
// these instead of a flat LeaveType.daysPerYear whenever the employee has a
// leaveCategory set.
@ApiTags('Leave Category Policies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leave-category-policies')
export class LeaveCategoryPolicyController {
  constructor(private service: LeaveCategoryPolicyService) {}

  @Post()
  @Roles('ADMIN', 'HR')
  create(@Body() dto: CreateLeaveCategoryPolicyDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.id);
  }

  @Get()
  findAll(@Query('leaveCategory') leaveCategory?: string) {
    return this.service.findAll(leaveCategory);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'HR')
  update(@Param('id') id: string, @Body() dto: UpdateLeaveCategoryPolicyDto, @CurrentUser() user: any) {
    return this.service.update(id, dto, user.id);
  }

  @Delete(':id')
  @Roles('ADMIN', 'HR')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user.id);
  }
}
