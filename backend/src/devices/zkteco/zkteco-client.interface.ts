/**
 * Contract for talking to a ZKTeco uFace 800 Plus biometric terminal.
 *
 * This interface is intentionally modeled after the operations exposed by
 * common ZKTeco SDKs / TCP protocols (e.g. node-zklib, ZKTeco Push SDK,
 * pyzk). Swap `ZktecoMockClient` for a real implementation that talks to
 * the device over TCP (ip:port) without changing any calling code in
 * DevicesService / AttendanceService.
 */

export interface DeviceInfo {
  serialNumber: string;
  firmwareVersion: string;
  deviceTime: Date;
  userCount: number;
  fingerprintCount: number;
  faceCount: number;
  recordCount: number;
  storageUsedPercent: number;
}

export interface DeviceUser {
  deviceUserId: string;
  name: string;
  cardNumber?: string;
  hasFingerprint: boolean;
  hasFace: boolean;
}

export interface RawPunch {
  deviceUserId: string;
  timestamp: Date;
  /** Not all ZKTeco protocol libraries expose verify method or direction. */
  verifyMode?: 'FINGERPRINT' | 'FACE' | 'RFID' | 'PIN';
  inOutMode?: 'IN' | 'OUT' | 'BREAK_OUT' | 'BREAK_IN';
}

export interface ZktecoClient {
  /** Open a TCP connection to the device. */
  connect(ip: string, port: number): Promise<boolean>;

  /** Close the TCP connection. */
  disconnect(): Promise<void>;

  /** Ping the device to verify it is reachable. */
  testConnection(ip: string, port: number): Promise<boolean>;

  /** Retrieve device metadata (serial, firmware, clock, storage usage). */
  getInfo(ip: string, port: number): Promise<DeviceInfo>;

  /** List every user currently enrolled on the device itself. */
  getUsers(ip: string, port: number): Promise<DeviceUser[]>;

  /**
   * Push the device clock to match the server clock.
   * Some client implementations may not support this — see implementation notes.
   */
  syncTime(ip: string, port: number): Promise<Date>;

  /**
   * Reboot the terminal.
   * Some client implementations may not support this — see implementation notes.
   */
  restart(ip: string, port: number): Promise<boolean>;

  /**
   * Create or update a user record on the device (name + card number).
   * Not every ZKTeco protocol library exposes a safe, verified way to write
   * user records remotely — implementations that can't support this should
   * throw a clear, descriptive error rather than silently no-op.
   */
  setUser(ip: string, port: number, user: DeviceUser): Promise<boolean>;

  /** Remove a user (and their biometric templates) from the device. */
  deleteUser(ip: string, port: number, deviceUserId: string): Promise<boolean>;

  /** Remove only the fingerprint/face templates, keeping the user record. */
  clearTemplates(ip: string, port: number, deviceUserId: string): Promise<boolean>;

  /** Download all punches recorded since the last pull. */
  getAttendanceLogs(ip: string, port: number): Promise<RawPunch[]>;
}
