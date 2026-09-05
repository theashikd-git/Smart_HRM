import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ZktecoClient } from './zkteco/zkteco-client.interface';
import { ZKTECO_CLIENT } from './zkteco/zkteco-client.token';
import { SyncOperation, SyncResultStatus } from '@prisma/client';

/**
 * Owns all "employee -> device" synchronization. Smart HRM is always the
 * source of truth: whenever an employee is created, updated, disabled, or
 * deleted here, this service pushes that change out to the enrolled
 * biometric device and records the outcome in SyncHistory.
 */
@Injectable()
export class DeviceSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeviceSyncService.name);
  private retryTimer: NodeJS.Timeout | null = null;
  private isRetrying = false;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    @Inject(ZKTECO_CLIENT) private zkteco: ZktecoClient,
  ) {}

  /**
   * A failed/pending employee push used to require someone to notice and
   * click "Retry Failed" on the Device page. This runs that same retry
   * automatically on a schedule, so a transient device blip (offline for a
   * few minutes, network hiccup) heals itself without manual intervention.
   * Set EMPLOYEE_SYNC_RETRY_INTERVAL_MS=0 to disable.
   */
  onModuleInit() {
    const intervalMs = Number(this.config.get('EMPLOYEE_SYNC_RETRY_INTERVAL_MS')) || 5 * 60_000;
    if (intervalMs <= 0) {
      this.logger.log('Automatic employee sync retry disabled (EMPLOYEE_SYNC_RETRY_INTERVAL_MS <= 0)');
      return;
    }
    this.retryTimer = setInterval(() => {
      this.autoRetry().catch((err) => this.logger.error(`Scheduled employee sync retry failed: ${err?.message ?? err}`));
    }, intervalMs);
    this.retryTimer.unref?.();
    this.logger.log(`Automatic employee sync retry scheduled every ${intervalMs}ms`);
  }

  onModuleDestroy() {
    if (this.retryTimer) clearInterval(this.retryTimer);
  }

  private async autoRetry() {
    if (this.isRetrying) return;
    this.isRetrying = true;
    try {
      const result = await this.bulkSync();
      if (result.total > 0) {
        this.logger.log(
          `Automatic employee sync retry: ${result.success} succeeded, ${result.failed} failed, ${result.total} total`,
        );
      }
    } finally {
      this.isRetrying = false;
    }
  }

  /** Pick the first (only, in v1) device configured in the system. */
  private async getPrimaryDevice() {
    return this.prisma.device.findFirst({ orderBy: { createdAt: 'asc' } });
  }

  private async recordHistory(params: {
    employeeId?: string;
    deviceId?: string;
    operation: SyncOperation;
    status: SyncResultStatus;
    message?: string;
  }) {
    return this.prisma.syncHistory.create({ data: params });
  }

  /** Push a brand-new employee's basic identity to the device. */
  async pushNewEmployee(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return;

    const device = await this.getPrimaryDevice();
    if (!device) {
      await this.prisma.employee.update({
        where: { id: employeeId },
        data: { syncStatus: 'FAILED' },
      });
      await this.recordHistory({
        employeeId,
        operation: 'PUSH_NEW',
        status: 'FAILED',
        message: 'No biometric device configured',
      });
      return;
    }

    const deviceUserId = employee.deviceUserId ?? employee.employeeCode;

    try {
      await this.zkteco.setUser(device.ipAddress, device.port, {
        deviceUserId,
        name: employee.fullName,
        cardNumber: employee.rfidCardNumber ?? undefined,
        hasFingerprint: false,
        hasFace: false,
      });

      await this.prisma.employee.update({
        where: { id: employeeId },
        data: { deviceUserId, syncStatus: 'SYNCED', lastSyncDate: new Date() },
      });

      await this.recordHistory({
        employeeId,
        deviceId: device.id,
        operation: 'PUSH_NEW',
        status: 'SUCCESS',
        message: `Pushed to ${device.name}`,
      });
    } catch (err: any) {
      await this.prisma.employee.update({ where: { id: employeeId }, data: { syncStatus: 'FAILED' } });
      await this.recordHistory({
        employeeId,
        deviceId: device.id,
        operation: 'PUSH_NEW',
        status: 'FAILED',
        message: err?.message ?? 'Unknown error',
      });
    }
  }

  /** Re-push an updated employee record (name / card number changes). */
  async pushUpdate(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee || !employee.deviceUserId) return this.pushNewEmployee(employeeId);

    const device = await this.getPrimaryDevice();
    if (!device) return;

    try {
      await this.zkteco.setUser(device.ipAddress, device.port, {
        deviceUserId: employee.deviceUserId,
        name: employee.fullName,
        cardNumber: employee.rfidCardNumber ?? undefined,
        hasFingerprint: employee.fingerprintEnrolled,
        hasFace: employee.faceEnrolled,
      });

      await this.prisma.employee.update({
        where: { id: employeeId },
        data: { syncStatus: 'SYNCED', lastSyncDate: new Date() },
      });

      await this.recordHistory({
        employeeId,
        deviceId: device.id,
        operation: 'UPDATE',
        status: 'SUCCESS',
      });
    } catch (err: any) {
      await this.prisma.employee.update({ where: { id: employeeId }, data: { syncStatus: 'FAILED' } });
      await this.recordHistory({
        employeeId,
        deviceId: device.id,
        operation: 'UPDATE',
        status: 'FAILED',
        message: err?.message ?? 'Unknown error',
      });
    }
  }

  /** Remove the employee entirely from the device (hard delete). */
  async pushDelete(employeeId: string, deviceUserId: string | null) {
    const device = await this.getPrimaryDevice();
    if (!device || !deviceUserId) return;

    try {
      await this.zkteco.deleteUser(device.ipAddress, device.port, deviceUserId);
      await this.recordHistory({
        employeeId,
        deviceId: device.id,
        operation: 'DELETE',
        status: 'SUCCESS',
      });
    } catch (err: any) {
      await this.recordHistory({
        employeeId,
        deviceId: device.id,
        operation: 'DELETE',
        status: 'FAILED',
        message: err?.message ?? 'Unknown error',
      });
    }
  }

  /** Disable an employee: keep the device record but flag them inactive in HRM. */
  async pushDisable(employeeId: string) {
    await this.recordHistory({
      employeeId,
      operation: 'DISABLE',
      status: 'SUCCESS',
      message: 'Employee marked inactive in HRM; device record retained',
    });
  }

  /**
   * Reverse of every other method in this class: pulls the user list that
   * already exists ON the device (enrolled directly at the terminal, or
   * from before Smart HRM was installed) and creates matching Employee
   * records here. Anyone whose deviceUserId is already linked to an
   * existing employee is left alone -- this only fills in employees Smart
   * HRM doesn't know about yet, it never overwrites HRM data with device
   * data.
   */
  async importFromDevice(deviceId: string) {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Device not found');

    const deviceUsers = await this.zkteco.getUsers(device.ipAddress, device.port);

    let imported = 0;
    let skipped = 0;

    for (const du of deviceUsers) {
      const existing = await this.prisma.employee.findUnique({ where: { deviceUserId: du.deviceUserId } });
      if (existing) {
        skipped++;
        continue;
      }

      // employeeCode must be unique; the device user ID is usually free
      // since it's a separate namespace, but fall back to a prefixed
      // variant if some earlier employee happens to already use it.
      let employeeCode = du.deviceUserId;
      const codeTaken = await this.prisma.employee.findUnique({ where: { employeeCode } });
      if (codeTaken) employeeCode = `DEV-${du.deviceUserId}`;

      const employee = await this.prisma.employee.create({
        data: {
          employeeCode,
          fullName: du.name?.trim() || `Device User ${du.deviceUserId}`,
          deviceUserId: du.deviceUserId,
          status: 'ACTIVE',
          syncStatus: 'SYNCED',
          lastSyncDate: new Date(),
          fingerprintEnrolled: du.hasFingerprint,
          faceEnrolled: du.hasFace,
          rfidCardNumber: du.cardNumber,
        },
      });

      await this.recordHistory({
        employeeId: employee.id,
        deviceId,
        operation: 'PUSH_NEW',
        status: 'SUCCESS',
        message: `Imported from device (was already enrolled on ${device.name})`,
      });
      imported++;
    }

    await this.recordHistory({
      deviceId,
      operation: 'BULK',
      status: 'SUCCESS',
      message: `Imported ${imported} new employee(s) from device, skipped ${skipped} already linked. ${deviceUsers.length} total on device.`,
    });

    return { total: deviceUsers.length, imported, skipped };
  }

  /** Push every unsynced/failed employee at once. */
  async bulkSync(actorId?: string) {
    const pending = await this.prisma.employee.findMany({
      where: { syncStatus: { in: ['NOT_SYNCED', 'FAILED', 'PENDING'] }, status: 'ACTIVE' },
    });

    let success = 0;
    let failed = 0;

    for (const employee of pending) {
      await this.pushNewEmployee(employee.id);
      const updated = await this.prisma.employee.findUnique({ where: { id: employee.id } });
      if (updated?.syncStatus === 'SYNCED') success++;
      else failed++;
    }

    await this.recordHistory({
      operation: 'BULK',
      status: failed === 0 ? 'SUCCESS' : 'RETRYING',
      message: `Bulk sync: ${success} succeeded, ${failed} failed, ${pending.length} total`,
    });

    return { total: pending.length, success, failed };
  }

  async retryFailed() {
    return this.bulkSync();
  }

  async getSyncHistory(employeeId?: string) {
    return this.prisma.syncHistory.findMany({
      where: employeeId ? { employeeId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        employee: { select: { fullName: true, employeeCode: true } },
        device: { select: { name: true } },
      },
    });
  }
}
