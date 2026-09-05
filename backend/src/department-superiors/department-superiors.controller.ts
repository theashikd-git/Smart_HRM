import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DepartmentSuperiorsService } from './department-superiors.service';
import { CreateDepartmentSuperiorDto } from './dto/department-superior.dto';

@ApiTags('Department Superiors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('department-superiors')
export class DepartmentSuperiorsController {
  constructor(private service: DepartmentSuperiorsService) {}

  @Post()
  @Roles('ADMIN', 'HR')
  create(@Body() dto: CreateDepartmentSuperiorDto, @CurrentUser() user: any) {
    return this.service.create(dto, user.id);
  }

  @Get()
  findAll(@Query('departmentId') departmentId?: string, @Query('subDepartmentId') subDepartmentId?: string) {
    return this.service.findAll(departmentId, subDepartmentId);
  }

  @Delete(':id')
  @Roles('ADMIN', 'HR')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user.id);
  }
}
