import { Injectable, Logger } from '@nestjs/common';
import {
  DeviceInfo,
  DeviceUser,
  RawPunch,
  ZktecoClient,
} from './zkteco-client.interface';

/**
 * Simulated ZKTeco uFace 800 Plus.
 *
 * No physical device or local network is available in every environment
 * (development machines, CI, this sandbox), so this client fakes realistic
 * responses with small latency and an in-memory "device state" per IP.
 * It implements the exact same ZktecoClient interface a real TCP-based SDK
 * would, so it can be swapped out in devices.module.ts by providing a real
 * implementation (e.g. wrapping `node-zklib`) with no changes anywhere else.
 */
@Injectable()
export class ZktecoMockClient implements ZktecoClient {
  private readonly logger = new Logger(ZktecoMockClient.name);
  private registeredUsers = new Map<string, Map<string, DeviceUser>>();

  private delay(ms = 150) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private key(ip: string, port: number) {
    return `${ip}:${port}`;
  }

  async connect(ip: string, port: number): Promise<boolean> {
    await this.delay();
    this.logger.log(`[MOCK] Connected to device at ${ip}:${port}`);
    return true;
  }

  async disconnect(): Promise<void> {
    await this.delay(50);
  }

  async testConnection(ip: string, port: number): Promise<boolean> {
    await this.delay();
    // Simulate that a well-formed private IP responds; otherwise unreachable.
    const reachable = /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) && port > 0;
    return reachable;
  }

  async getInfo(ip: string, port: number): Promise<DeviceInfo> {
    await this.delay();
    const users = this.registeredUsers.get(this.key(ip, port));
    const userCount = users ? users.size : 0;
    return {
      serialNumber: `ZK${Buffer.from(ip).toString('hex').slice(0, 10).toUpperCase()}`,
      firmwareVersion: 'Ver 6.60 Sep 12 2024',
      deviceTime: new Date(),
      userCount,
      fingerprintCount: users
        ? Array.from(users.values()).filter((u) => u.hasFingerprint).length
        : 0,
      faceCount: users ? Array.from(users.values()).filter((u) => u.hasFace).length : 0,
      recordCount: userCount * 20,
      storageUsedPercent: Math.min(95, 5 + userCount * 2),
    };
  }

  async syncTime(ip: string, port: number): Promise<Date> {
    await this.delay();
    return new Date();
  }

  async restart(ip: string, port: number): Promise<boolean> {
    await this.delay(400);
    return true;
  }

  async setUser(ip: string, port: number, user: DeviceUser): Promise<boolean> {
    await this.delay();
    const mapKey = this.key(ip, port);
    if (!this.registeredUsers.has(mapKey)) {
      this.registeredUsers.set(mapKey, new Map());
    }
    this.registeredUsers.get(mapKey)!.set(user.deviceUserId, user);
    this.logger.log(`[MOCK] Pushed user ${user.deviceUserId} (${user.name}) to ${mapKey}`);
    return true;
  }

  async deleteUser(ip: string, port: number, deviceUserId: string): Promise<boolean> {
    await this.delay();
    this.registeredUsers.get(this.key(ip, port))?.delete(deviceUserId);
    return true;
  }

  async clearTemplates(ip: string, port: number, deviceUserId: string): Promise<boolean> {
    await this.delay();
    const user = this.registeredUsers.get(this.key(ip, port))?.get(deviceUserId);
    if (user) {
      user.hasFingerprint = false;
      user.hasFace = false;
    }
    return true;
  }

  async getUsers(ip: string, port: number): Promise<DeviceUser[]> {
    await this.delay();
    const users = this.registeredUsers.get(this.key(ip, port));
    return users ? Array.from(users.values()) : [];
  }

  async getAttendanceLogs(ip: string, port: number): Promise<RawPunch[]> {
    await this.delay(300);
    const users = this.registeredUsers.get(this.key(ip, port));
    if (!users || users.size === 0) return [];

    // Simulate that a handful of enrolled users punched in/out "today".
    const punches: RawPunch[] = [];
    const modes: RawPunch['verifyMode'][] = ['FINGERPRINT', 'FACE', 'RFID'];
    const now = new Date();

    for (const user of users.values()) {
      const punchesToday = Math.random() > 0.15; // most people show up
      if (!punchesToday) continue;

      const checkIn = new Date(now);
      checkIn.setHours(8 + Math.round(Math.random() * 2), Math.round(Math.random() * 59), 0, 0);
      punches.push({
        deviceUserId: user.deviceUserId,
        timestamp: checkIn,
        verifyMode: modes[Math.floor(Math.random() * modes.length)],
        inOutMode: 'IN',
      });

      if (Math.random() > 0.1) {
        const checkOut = new Date(now);
        checkOut.setHours(17 + Math.round(Math.random() * 2), Math.round(Math.random() * 59), 0, 0);
        punches.push({
          deviceUserId: user.deviceUserId,
          timestamp: checkOut,
          verifyMode: modes[Math.floor(Math.random() * modes.length)],
          inOutMode: 'OUT',
        });
      }
    }

    return punches;
  }
}
