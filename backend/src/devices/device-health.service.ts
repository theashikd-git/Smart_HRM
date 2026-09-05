import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ZktecoClient } from './zkteco/zkteco-client.interface';
import { ZKTECO_CLIENT } from './zkteco/zkteco-client.token';

/**
 * Background heartbeat for every configured device: periodically probes
 * reachability and keeps Device.connectionStatus in the database honest,
 * so the UI reflects reality (including a device coming BACK online after
 * a network blip) without a human having to click "Test connection".
 *
 * A DeviceLog entry is only written when status actually changes -- not
 * every tick -- to avoid flooding the log with "still online" noise.
 */
@Injectable()
export class DeviceHealthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeviceHealthService.name);
  private timer: NodeJS.Timeout | null = null;
  private readonly intervalMs: number;
  private running = false;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    @Inject(ZKTECO_CLIENT) private zkteco: ZktecoClient,
  ) {
    this.intervalMs = Number(this.config.get('DEVICE_HEARTBEAT_INTERVAL_MS')) || 60_000;
  }

  onModuleInit() {
    if (this.intervalMs <= 0) {
      this.logger.log('Device heartbeat disabled (DEVICE_HEARTBEAT_INTERVAL_MS <= 0)');
      return;
    }
    this.timer = setInterval(() => this.tick().catch((err) => this.logger.error(err)), this.intervalMs);
    this.timer.unref?.();
    // Kick off an initial check shortly after boot rather than waiting a
    // full interval for the first result.
    setTimeout(() => this.tick().catch((err) => this.logger.error(err)), 5_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    // Skip overlapping runs -- if a previous heartbeat is still in flight
    // (e.g. a slow/unreachable device dragging out its timeout), don't
    // stack a second pass on top of it.
    if (this.running) return;
    this.running = true;
    try {
      const devices = await this.prisma.device.findMany();
      for (const device of devices) {
        const reachable = await this.zkteco
          .testConnection(device.ipAddress, device.port)
          .catch(() => false);
        const newStatus = reachable ? 'ONLINE' : 'OFFLINE';
        if (device.connectionStatus !== newStatus) {
          await this.prisma.device.update({
            where: { id: device.id },
            data: { connectionStatus: newStatus, lastCommunication: new Date() },
          });
          await this.prisma.deviceLog.create({
            data: {
              deviceId: device.id,
              level: reachable ? 'INFO' : 'WARNING',
              message: reachable
                ? 'Device came back online (heartbeat)'
                : 'Device unreachable (heartbeat)',
            },
          });
          this.logger.log(`${device.name} (${device.ipAddress}) is now ${newStatus}`);
        } else if (reachable) {
          await this.prisma.device.update({
            where: { id: device.id },
            data: { lastCommunication: new Date() },
          });
        }
      }
    } finally {
      this.running = false;
    }
  }
}
