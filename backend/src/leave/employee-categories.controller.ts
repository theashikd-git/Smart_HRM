import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { EmployeeCategoriesService } from './employee-categories.service';
import { CreateEmployeeCategoryDto, UpdateEmployeeCategoryDto } from './dto/employee-category.dto';

// HR-configurable employee-type categories (Permanent, Provision,
// Contractual, Trial by default, but HR can add/rename more) -- what
// Employee.leaveCategoryId and LeaveCategoryPolicy.leaveCategoryId point at.
@ApiTags('Employee Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('employee-categories')
export class EmployeeCategoriesController {
  constructor(private service: EmployeeCategoriesService) {}

  @Post()
  @Roles('ADMIN', 'HR')
  create(@Body() dto: CreateEmployeeCategoryDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.id);
  }

  @Get()
  findAll(@Query('includeInactive') includeInactive?: string) {
    return this.service.findAll(includeInactive === 'true');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'HR')
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeCategoryDto, @CurrentUser() user: any) {
    return this.service.update(id, dto, user.id);
  }

  @Delete(':id')
  @Roles('ADMIN', 'HR')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user.id);
  }
}
