import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { DeviceSyncService } from './device-sync.service';
import { DeviceHealthService } from './device-health.service';
import { ZktecoMockClient } from './zkteco/zkteco-mock-client';
import { ZktecoRealClient } from './zkteco/zkteco-real-client';
import { ZKTECO_CLIENT } from './zkteco/zkteco-client.token';
import { AuditModule } from '../audit/audit.module';

/**
 * Which ZKTeco driver to use is controlled by the ZKTECO_DRIVER env var:
 *   - "mock" (default) - safe, in-memory simulation, no hardware needed.
 *   - "real"            - connects to an actual ZKTeco uFace 800 Plus (or
 *                          compatible device) over TCP via node-zklib.
 *                          Requires the device to be reachable on your
 *                          network. See zkteco-real-client.ts for safety
 *                          notes on write operations before pointing this
 *                          at a production device.
 */
const zktecoClientProvider = {
  provide: ZKTECO_CLIENT,
  inject: [ConfigService, ZktecoMockClient, ZktecoRealClient],
  useFactory: (
    config: ConfigService,
    mockClient: ZktecoMockClient,
    realClient: ZktecoRealClient,
  ) => {
    const driver = (config.get<string>('ZKTECO_DRIVER') || 'mock').toLowerCase();
    return driver === 'real' ? realClient : mockClient;
  },
};

@Module({
  imports: [AuditModule, ConfigModule],
  providers: [
    DevicesService,
    DeviceSyncService,
    DeviceHealthService,
    ZktecoMockClient,
    ZktecoRealClient,
    zktecoClientProvider,
  ],
  controllers: [DevicesController],
  exports: [DevicesService, DeviceSyncService, ZKTECO_CLIENT],
})
export class DevicesModule {}
