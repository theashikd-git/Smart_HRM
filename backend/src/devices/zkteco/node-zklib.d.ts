declare module 'node-zklib' {
  interface ZKUser {
    uid: number;
    role: number;
    password: string;
    name: string;
    cardno: number;
    userId: string;
  }

  interface ZKAttendanceRecord {
    userSn: number;
    deviceUserId: string;
    recordTime: Date;
    ip?: string;
  }

  interface ZKGetUsersResult {
    data: ZKUser[];
    err: unknown;
  }

  interface ZKGetAttendancesResult {
    data: ZKAttendanceRecord[];
    err: unknown;
  }

  interface ZKInfo {
    userCounts: number;
    logCounts: number;
    logCapacity: number;
  }

  class ZKLib {
    constructor(ip: string, port: number, timeout?: number, inport?: number);
    createSocket(cbErr?: (err: Error) => void, cbClose?: () => void): Promise<void>;
    disconnect(): Promise<void>;
    getUsers(): Promise<ZKGetUsersResult>;
    getAttendances(cb?: (percent: number, total: number) => void): Promise<ZKGetAttendancesResult>;
    getInfo(): Promise<ZKInfo>;
    // NOTE: node-zklib@1.3.0 exposes getSocketStatus() on ZKLib, but it
    // delegates to a method (zklibTcp.getSocketStatus / zklibUdp.getSocketStatus)
    // that is never actually defined on either transport class — calling it
    // always throws "is not a function". Do not use it for health checks;
    // ZktecoRealClient inspects the underlying socket directly instead.
    freeData(): Promise<unknown>;
    disableDevice(): Promise<unknown>;
    enableDevice(): Promise<unknown>;
    clearAttendanceLog(): Promise<unknown>;
    executeCmd(command: number, data?: string | Buffer): Promise<Buffer>;
  }

  export = ZKLib;
}
