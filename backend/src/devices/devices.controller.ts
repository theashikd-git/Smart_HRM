import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DevicesService } from './devices.service';
import { DeviceSyncService } from './device-sync.service';
import { CreateDeviceDto, UpdateDeviceDto } from './dto/device.dto';

@ApiTags('Devices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('devices')
export class DevicesController {
  constructor(
    private devicesService: DevicesService,
    private deviceSyncService: DeviceSyncService,
  ) {}

  @Post()
  @Roles('ADMIN')
  create(@Body() dto: CreateDeviceDto, @CurrentUser() user: any) {
    return this.devicesService.create(dto, user.id);
  }

  @Get()
  findAll() {
    return this.devicesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.devicesService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateDeviceDto, @CurrentUser() user: any) {
    return this.devicesService.update(id, dto, user.id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.devicesService.remove(id, user.id);
  }

  @Post(':id/connect')
  @Roles('ADMIN', 'HR')
  connect(@Param('id') id: string, @CurrentUser() user: any) {
    return this.devicesService.connect(id, user.id);
  }

  @Post(':id/disconnect')
  @Roles('ADMIN', 'HR')
  disconnect(@Param('id') id: string, @CurrentUser() user: any) {
    return this.devicesService.disconnect(id, user.id);
  }

  @Get(':id/test-connection')
  @Roles('ADMIN', 'HR')
  testConnection(@Param('id') id: string) {
    return this.devicesService.testConnection(id);
  }

  @Post(':id/restart')
  @Roles('ADMIN')
  restart(@Param('id') id: string, @CurrentUser() user: any) {
    return this.devicesService.restart(id, user.id);
  }

  @Post(':id/sync-time')
  @Roles('ADMIN', 'HR')
  syncTime(@Param('id') id: string, @CurrentUser() user: any) {
    return this.devicesService.syncTime(id, user.id);
  }

  @Get(':id/info')
  @Roles('ADMIN', 'HR')
  getInfo(@Param('id') id: string) {
    return this.devicesService.getInfo(id);
  }

  @Get(':id/users')
  @Roles('ADMIN', 'HR')
  getUsers(@Param('id') id: string) {
    return this.devicesService.getUsers(id);
  }

  @Get(':id/logs')
  @Roles('ADMIN', 'HR')
  getLogs(@Param('id') id: string) {
    return this.devicesService.getLogs(id);
  }

  // -- Employee synchronization -------------------------------------------

  @Post(':id/import-users')
  @Roles('ADMIN', 'HR')
  importUsers(@Param('id') id: string) {
    return this.deviceSyncService.importFromDevice(id);
  }

  @Post('sync/bulk')
  @Roles('ADMIN', 'HR')
  bulkSync() {
    return this.deviceSyncService.bulkSync();
  }

  @Post('sync/retry-failed')
  @Roles('ADMIN', 'HR')
  retryFailed() {
    return this.deviceSyncService.retryFailed();
  }

  @Get('sync/history')
  @Roles('ADMIN', 'HR')
  syncHistory(@Query('employeeId') employeeId?: string) {
    return this.deviceSyncService.getSyncHistory(employeeId);
  }
}
