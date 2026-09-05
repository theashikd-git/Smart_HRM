import { Injectable, Inject, Logger, NotFoundException, BadGatewayException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ZktecoClient } from './zkteco/zkteco-client.interface';
import { ZKTECO_CLIENT } from './zkteco/zkteco-client.token';
import { CreateDeviceDto, UpdateDeviceDto } from './dto/device.dto';

@Injectable()
export class DevicesService {
  private readonly logger = new Logger(DevicesService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
    @Inject(ZKTECO_CLIENT) private zkteco: ZktecoClient,
  ) {}

  async create(dto: CreateDeviceDto, actorId?: string) {
    const device = await this.prisma.device.create({
      data: {
        name: dto.name,
        deviceModel: dto.deviceModel || 'ZKTeco uFace 800 Plus',
        ipAddress: dto.ipAddress,
        port: dto.port || 4370,
        connectionStatus: 'UNKNOWN',
      },
    });
    await this.auditService.log({
      userId: actorId,
      action: 'DEVICE_ADDED',
      entity: 'Device',
      entityId: device.id,
      details: `Added device ${device.name} (${device.ipAddress}:${device.port})`,
    });
    return device;
  }

  findAll() {
    return this.prisma.device.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async findOne(id: string) {
    const device = await this.prisma.device.findUnique({ where: { id } });
    if (!device) throw new NotFoundException('Device not found');
    return device;
  }

  async update(id: string, dto: UpdateDeviceDto, actorId?: string) {
    await this.findOne(id);
    const device = await this.prisma.device.update({ where: { id }, data: dto });
    await this.auditService.log({
      userId: actorId,
      action: 'DEVICE_UPDATED',
      entity: 'Device',
      entityId: id,
    });
    return device;
  }

  async remove(id: string, actorId?: string) {
    await this.findOne(id);
    await this.prisma.device.delete({ where: { id } });
    await this.auditService.log({
      userId: actorId,
      action: 'DEVICE_REMOVED',
      entity: 'Device',
      entityId: id,
    });
    return { success: true };
  }

  async connect(id: string, actorId?: string) {
    const device = await this.findOne(id);
    let ok = false;
    let errorMessage: string | undefined;
    try {
      ok = await this.zkteco.connect(device.ipAddress, device.port);
    } catch (err: any) {
      // ZktecoClient.connect() is documented to resolve to false rather
      // than throw, but guard here too -- a device operation should never
      // be able to 500 the API without leaving a trace of why.
      ok = false;
      errorMessage = err?.message ?? 'Unknown error';
      this.logger.error(`connect() threw for device ${id}: ${errorMessage}`);
    }

    const updated = await this.prisma.device.update({
      where: { id },
      data: {
        connectionStatus: ok ? 'ONLINE' : 'OFFLINE',
        lastCommunication: new Date(),
      },
    });
    await this.addDeviceLog(
      id,
      ok ? 'INFO' : 'ERROR',
      ok ? 'Connected successfully' : `Connection failed${errorMessage ? `: ${errorMessage}` : ''}`,
    );
    await this.auditService.log({
      userId: actorId,
      action: 'DEVICE_CONNECTED',
      entity: 'Device',
      entityId: id,
    });
    return updated;
  }

  async disconnect(id: string, actorId?: string) {
    const device = await this.findOne(id);
    await this.zkteco.disconnect();
    const updated = await this.prisma.device.update({
      where: { id },
      data: { connectionStatus: 'OFFLINE' },
    });
    await this.addDeviceLog(id, 'INFO', 'Disconnected');
    await this.auditService.log({
      userId: actorId,
      action: 'DEVICE_DISCONNECTED',
      entity: 'Device',
      entityId: id,
    });
    return updated;
  }

  async testConnection(id: string) {
    const device = await this.findOne(id);
    const ok = await this.zkteco.testConnection(device.ipAddress, device.port);
    await this.addDeviceLog(id, ok ? 'INFO' : 'WARNING', `Connection test: ${ok ? 'reachable' : 'unreachable'}`);
    return { reachable: ok };
  }

  async restart(id: string, actorId?: string) {
    const device = await this.findOne(id);
    const ok = await this.zkteco.restart(device.ipAddress, device.port);
    await this.prisma.device.update({
      where: { id },
      data: { connectionStatus: ok ? 'ONLINE' : 'OFFLINE' },
    });
    await this.addDeviceLog(id, ok ? 'INFO' : 'ERROR', ok ? 'Restart command sent' : 'Restart command failed');
    await this.auditService.log({
      userId: actorId,
      action: 'DEVICE_RESTARTED',
      entity: 'Device',
      entityId: id,
    });
    return { success: ok };
  }

  async syncTime(id: string, actorId?: string) {
    const device = await this.findOne(id);
    try {
      const deviceTime = await this.zkteco.syncTime(device.ipAddress, device.port);
      const updated = await this.prisma.device.update({
        where: { id },
        data: { deviceTime, lastCommunication: new Date(), connectionStatus: 'ONLINE' },
      });
      await this.addDeviceLog(id, 'INFO', 'Device clock synchronized');
      await this.auditService.log({
        userId: actorId,
        action: 'DEVICE_TIME_SYNCED',
        entity: 'Device',
        entityId: id,
      });
      return updated;
    } catch (err: any) {
      await this.prisma.device.update({ where: { id }, data: { connectionStatus: 'OFFLINE' } });
      const message = `Could not reach ${device.name}: ${err?.message ?? 'connection failed'}`;
      await this.addDeviceLog(id, 'ERROR', `Time sync failed: ${err?.message ?? 'Unknown error'}`);
      throw new BadGatewayException(message);
    }
  }

  async getInfo(id: string) {
    const device = await this.findOne(id);
    try {
      const info = await this.zkteco.getInfo(device.ipAddress, device.port);
      await this.prisma.device.update({
        where: { id },
        data: {
          serialNumber: info.serialNumber,
          firmwareVersion: info.firmwareVersion,
          storageUsed: info.storageUsedPercent,
          lastCommunication: new Date(),
          connectionStatus: 'ONLINE',
        },
      });
      return info;
    } catch (err: any) {
      await this.prisma.device.update({ where: { id }, data: { connectionStatus: 'OFFLINE' } });
      const message = `Could not reach ${device.name}: ${err?.message ?? 'connection failed'}`;
      await this.addDeviceLog(id, 'ERROR', `getInfo failed: ${err?.message ?? 'Unknown error'}`);
      throw new BadGatewayException(message);
    }
  }

  async getUsers(id: string) {
    const device = await this.findOne(id);
    try {
      const users = await this.zkteco.getUsers(device.ipAddress, device.port);
      await this.prisma.device.update({
        where: { id },
        data: { lastCommunication: new Date(), connectionStatus: 'ONLINE' },
      });
      return users;
    } catch (err: any) {
      await this.prisma.device.update({ where: { id }, data: { connectionStatus: 'OFFLINE' } });
      const message = `Could not reach ${device.name}: ${err?.message ?? 'connection failed'}`;
      await this.addDeviceLog(id, 'ERROR', `getUsers failed: ${err?.message ?? 'Unknown error'}`);
      throw new BadGatewayException(message);
    }
  }

  async getLogs(id: string) {
    await this.findOne(id);
    return this.prisma.deviceLog.findMany({
      where: { deviceId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  private async addDeviceLog(deviceId: string, level: string, message: string) {
    return this.prisma.deviceLog.create({ data: { deviceId, level, message } });
  }
}
