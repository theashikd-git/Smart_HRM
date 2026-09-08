import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ZKLib = require('node-zklib');
import {
  DeviceInfo,
  DeviceUser,
  RawPunch,
  ZktecoClient,
} from './zkteco-client.interface';

// Raw ZK protocol command codes not exposed as convenience methods by
// node-zklib. Values match node-zklib/constants.js exactly (verified
// against the published v1.3.0 source).
const CMD_RESTART = 1004;
const CMD_USER_WRQ = 8;
const CMD_DELETE_USER = 18;
const CMD_DELETE_USERTEMP = 19;
const CMD_GET_TIME = 201;
const CMD_SET_TIME = 202;
const CMD_OPTIONS_RRQ = 11;
// CMD_DELETE_USER / CMD_DELETE_USERTEMP only queue the change on some
// firmwares -- the terminal's *active* user table (what verification and
// the device's own user-list menu actually read from) isn't reloaded from
// that until CMD_REFRESHDATA is sent, or the device is rebooted. Without
// it, a delete looks like it worked (command acknowledged, no error, our
// own SyncHistory row says SUCCESS) but the person is still enrolled on
// the physical device. This matches pyzk's delete_user(), which calls the
// equivalent refresh after every delete for the same reason.
const CMD_REFRESHDATA = 1013;

interface ConnectionEntry {
  zk: InstanceType<typeof ZKLib>;
  /**
   * Serializes every command issued against this connection. The ZK TCP
   * protocol is a strict single request/response session -- issuing a
   * second command before the first reply has arrived corrupts BOTH
   * replies (each side is listening for the next 'data' event on the same
   * socket). Every operation is chained onto this promise so only one
   * command is ever in flight per device connection, no matter how many
   * concurrent HTTP requests or scheduled jobs touch the same device at
   * once. This is not hypothetical: a scheduled attendance pull racing
   * an admin clicking "Get Info" in the UI would hit this today without
   * this queue.
   */
  queue: Promise<unknown>;
  lastUsedAt: number;
}

/**
 * Talks to a real ZKTeco uFace 800 Plus (or any device speaking the same
 * ZK TCP protocol family) using the `node-zklib` library for the
 * well-supported operations (connect, disconnect, getInfo, getUsers,
 * getAttendances), and raw protocol commands for the operations
 * node-zklib doesn't wrap (restart, set/get time, create/delete user,
 * delete template).
 *
 * The 72-byte user record layout used in encodeUser72() was reverse
 * derived directly from node-zklib's own `decodeUserData72` decoder
 * (see node_modules/node-zklib/utils.js), not guessed, so reads and
 * writes use a consistent, verified field layout.
 *
 * Reliability behavior implemented in this class (see inline comments on
 * each): one connection per device, reused and health-checked rather than
 * reopened on every call; commands on a connection are serialized through
 * `ConnectionEntry.queue`; failed calls trigger one automatic reconnect +
 * retry when the failure looks like a dropped socket; TCP connect is
 * guarded by an explicit timeout because node-zklib's own connect path
 * does not enforce one (see `openConnection`); idle connections are
 * released periodically since these terminals generally accept only one
 * active session at a time.
 *
 * IMPORTANT -- write operations (pushing/deleting users, clearing
 * templates) modify data directly on the physical device and have not
 * been validated against real ZKTeco hardware in this development
 * environment (no device was reachable). Before relying on this in
 * production:
 *   1. Test against a spare/non-critical device first, if you have one.
 *   2. Push a single test employee before running a bulk sync.
 *   3. Keep a manual backup/export of the device's user list beforehand
 *      (via the device's own menu, or `getUsers()` in this file) in case
 *      anything needs to be restored.
 */
@Injectable()
export class ZktecoRealClient implements ZktecoClient, OnModuleDestroy {
  private readonly logger = new Logger(ZktecoRealClient.name);
  private connections = new Map<string, ConnectionEntry>();
  /** ip:port -> (device uid -> deviceUserId) seen this process, purely to
   *  warn if two different employees hash to the same device slot. */
  private uidAssignments = new Map<string, Map<number, string>>();

  private readonly connectTimeoutMs: number;
  private readonly responseTimeoutMs: number;
  private readonly idleTimeoutMs: number;
  private readonly connectRetries: number;
  private readonly cleanupTimer: NodeJS.Timeout;

  constructor(private readonly config: ConfigService) {
    this.connectTimeoutMs = Number(this.config.get('ZKTECO_CONNECT_TIMEOUT_MS')) || 8000;
    this.responseTimeoutMs = Number(this.config.get('ZKTECO_RESPONSE_TIMEOUT_MS')) || 8000;
    this.idleTimeoutMs = Number(this.config.get('ZKTECO_IDLE_TIMEOUT_MS')) || 5 * 60_000;
    this.connectRetries = Number(this.config.get('ZKTECO_CONNECT_RETRIES')) || 2;

    // ZKTeco terminals generally accept only ONE active TCP session at a
    // time -- holding a connection open forever can lock the device's own
    // menu (or BioTime, if it's still installed) out indefinitely.
    // Releasing connections nobody has used in a while keeps that door open.
    this.cleanupTimer = setInterval(() => this.sweepIdleConnections(), 60_000);
    this.cleanupTimer.unref?.();
  }

  onModuleDestroy() {
    clearInterval(this.cleanupTimer);
    for (const [, entry] of this.connections) {
      entry.zk.disconnect().catch(() => undefined);
    }
    this.connections.clear();
  }

  private key(ip: string, port: number) {
    return `${ip}:${port}`;
  }

  private sweepIdleConnections() {
    const now = Date.now();
    for (const [k, entry] of this.connections.entries()) {
      if (now - entry.lastUsedAt > this.idleTimeoutMs) {
        this.logger.log(`Releasing idle connection to ${k} (idle > ${this.idleTimeoutMs}ms)`);
        entry.zk.disconnect().catch(() => undefined);
        this.connections.delete(k);
      }
    }
  }

  /**
   * Races a promise against a hard timeout. This matters specifically for
   * the initial TCP connect: node-zklib's `createSocket()` calls
   * `socket.setTimeout(ms)` but never attaches a `'timeout'` listener, so
   * for an unreachable-but-silent host (wrong IP, device powered off, a
   * firewall dropping packets instead of rejecting them) the connect
   * promise never resolves OR rejects -- it hangs forever. Without this
   * wrapper, that hang propagates straight up to whatever HTTP request
   * triggered it.
   */
  private withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${label} timed out after ${ms}ms`));
      }, ms);
      promise.then(
        (val) => {
          clearTimeout(timer);
          resolve(val);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        },
      );
    });
  }

  /**
   * node-zklib doesn't expose a working connection-status check (its own
   * `getSocketStatus()` calls a method neither transport class defines,
   * and always throws -- see node-zklib.d.ts) so we read the underlying
   * socket directly. `zklibTcp.socket` is set to `null` by the library
   * itself the moment the socket closes, so this is a cheap, reliable,
   * zero-network-round-trip health check.
   */
  private isDead(zk: InstanceType<typeof ZKLib>): boolean {
    const tcp = (zk as any).zklibTcp;
    const udp = (zk as any).zklibUdp;
    return !(tcp?.socket || udp?.socket);
  }

  private async openConnection(ip: string, port: number): Promise<InstanceType<typeof ZKLib>> {
    let lastErr: any;
    for (let attempt = 1; attempt <= this.connectRetries + 1; attempt++) {
      // UDP fallback local port left at 0 (OS-assigned ephemeral port)
      // rather than a fixed number -- a fixed inport shared across
      // multiple device connections causes EADDRINUSE the moment a second
      // device falls back to UDP at the same time.
      const zk = new ZKLib(ip, port, this.responseTimeoutMs, 0);
      try {
        await this.withTimeout(
          zk.createSocket(),
          this.connectTimeoutMs,
          `Connect to ${ip}:${port}`,
        );
        return zk;
      } catch (err: any) {
        lastErr = err;
        try {
          await zk.disconnect();
        } catch {
          // already dead -- nothing to clean up
        }
        if (attempt <= this.connectRetries) {
          const backoff = 500 * attempt;
          this.logger.warn(
            `Connect attempt ${attempt}/${this.connectRetries + 1} to ${ip}:${port} failed ` +
              `(${err.message}) -- retrying in ${backoff}ms`,
          );
          await new Promise((r) => setTimeout(r, backoff));
        }
      }
    }
    throw lastErr;
  }

  private async getOrCreateConnection(ip: string, port: number): Promise<ConnectionEntry> {
    const k = this.key(ip, port);
    const existing = this.connections.get(k);
    if (existing && !this.isDead(existing.zk)) {
      return existing;
    }
    if (existing) {
      this.connections.delete(k);
    }
    const zk = await this.openConnection(ip, port);
    const entry: ConnectionEntry = { zk, queue: Promise.resolve(), lastUsedAt: Date.now() };
    this.connections.set(k, entry);
    return entry;
  }

  /**
   * Runs `fn` against the pooled connection for ip:port, holding an
   * exclusive lock on that connection for the whole call so multi-step
   * operations (like getInfo's four round trips) can't get interleaved
   * with a competing caller's commands. If the call fails in a way that
   * looks like a dropped socket, this transparently reconnects once and
   * retries -- this is the "automatic reconnection if the device
   * disconnects" behavior.
   */
  private async withConnection<T>(
    ip: string,
    port: number,
    fn: (zk: InstanceType<typeof ZKLib>) => Promise<T>,
  ): Promise<T> {
    const entry = await this.getOrCreateConnection(ip, port);
    const run = entry.queue.then(() => fn(entry.zk));
    entry.queue = run.then(
      () => undefined,
      () => undefined, // keep the queue alive even if this call failed
    );
    entry.lastUsedAt = Date.now();

    try {
      return await run;
    } catch (err: any) {
      const looksDisconnected =
        this.isDead(entry.zk) ||
        /socket|econnreset|etimedout|epipe|not connected|econnrefused/i.test(err?.message ?? '');
      if (!looksDisconnected) {
        throw err;
      }
      this.logger.warn(
        `Connection to ${ip}:${port} appears to be down (${err.message}) -- ` +
          `reconnecting and retrying once`,
      );
      this.connections.delete(this.key(ip, port));
      const freshEntry = await this.getOrCreateConnection(ip, port);
      const retry = freshEntry.queue.then(() => fn(freshEntry.zk));
      freshEntry.queue = retry.then(
        () => undefined,
        () => undefined,
      );
      freshEntry.lastUsedAt = Date.now();
      return retry;
    }
  }

  async connect(ip: string, port: number): Promise<boolean> {
    const k = this.key(ip, port);
    const old = this.connections.get(k);
    if (old) {
      // Bug fix: an explicit reconnect used to call getConnection(..,
      // forceNew=true), which created a brand-new socket and overwrote the
      // map entry WITHOUT closing the previous one first. Every manual
      // "Connect" click leaked a TCP socket -- and since these terminals
      // typically accept only one active session, a leaked-but-still-open
      // prior session could make the *next* connect attempt fail for a
      // reason that looked nothing like its actual cause.
      await old.zk.disconnect().catch(() => undefined);
      this.connections.delete(k);
    }
    try {
      const zk = await this.openConnection(ip, port);
      this.connections.set(k, { zk, queue: Promise.resolve(), lastUsedAt: Date.now() });
      this.logger.log(`Connected to ZKTeco device at ${ip}:${port}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Failed to connect to ${ip}:${port} -- ${err.message}`);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    for (const [k, entry] of this.connections.entries()) {
      try {
        await entry.zk.disconnect();
      } catch {
        // ignore -- device may already be unreachable
      }
      this.connections.delete(k);
    }
  }

  async testConnection(ip: string, port: number): Promise<boolean> {
    const zk = new ZKLib(ip, port, 3000, 0);
    try {
      await this.withTimeout(
        zk.createSocket(),
        Math.min(this.connectTimeoutMs, 5000),
        `Test connection to ${ip}:${port}`,
      );
      await zk.disconnect().catch(() => undefined);
      return true;
    } catch {
      await zk.disconnect().catch(() => undefined);
      return false;
    }
  }

  async getInfo(ip: string, port: number): Promise<DeviceInfo> {
    return this.withConnection(ip, port, async (zk) => {
      const info = await zk.getInfo();
      const time = await this.readDeviceTime(zk);
      const serialNumber = await this.readOption(zk, '~SerialNumber');
      const firmwareVersion = await this.readOption(zk, '~ZKFPVersion');

      return {
        serialNumber: serialNumber || 'unknown',
        firmwareVersion: firmwareVersion || 'unknown',
        deviceTime: time,
        userCount: info.userCounts,
        // CMD_GET_FREE_SIZES does carry fingerprint/face counts on most
        // firmwares, but at byte offsets this library doesn't parse and
        // that we could not verify against a real uFace 800 in this
        // environment (no device reachable). Reporting 0 with this note
        // rather than guessing offsets and silently showing a number that
        // *looks* authoritative but might be wrong -- see README for how
        // to verify and wire up the real offsets against your own device.
        fingerprintCount: 0,
        faceCount: 0,
        recordCount: info.logCounts,
        storageUsedPercent:
          info.logCapacity > 0 ? Math.round((info.logCounts / info.logCapacity) * 100) : 0,
      };
    });
  }

  async getUsers(ip: string, port: number): Promise<DeviceUser[]> {
    return this.withConnection(ip, port, async (zk) => {
      const result = await zk.getUsers();
      // node-zklib's getUsers() decoder does not expose per-user
      // fingerprint/face enrollment flags (same limitation as the
      // aggregate counts in getInfo() -- see comment there), so both are
      // reported as false here rather than guessing. cardno of 0 means
      // "no RFID card issued" on this protocol, so it's mapped to undefined.
      return result.data.map((u) => ({
        deviceUserId: u.userId,
        name: u.name,
        cardNumber: u.cardno ? String(u.cardno) : undefined,
        hasFingerprint: false,
        hasFace: false,
      }));
    });
  }

  /**
   * Reads a device "option" value using the standard ZK option-query
   * convention: send the option name as an ascii, null-terminated string
   * via CMD_OPTIONS_RRQ, and the device replies with "OptionName=value".
   * Used here for serial number and firmware version, both of which are
   * simple, well-documented, read-only queries (unlike the write
   * operations above, there's minimal risk in getting this wrong -- a
   * failed query just returns 'unknown' rather than touching device state).
   */
  private async readOption(zk: InstanceType<typeof ZKLib>, option: string): Promise<string | null> {
    try {
      const query = Buffer.from(`${option}\0`, 'ascii');
      const reply = await zk.executeCmd(CMD_OPTIONS_RRQ, query);
      const text = reply.toString('ascii').replace(/\0/g, '');
      const eq = text.indexOf('=');
      return eq >= 0 ? text.slice(eq + 1).trim() : null;
    } catch {
      return null;
    }
  }

  async syncTime(ip: string, port: number): Promise<Date> {
    return this.withConnection(ip, port, async (zk) => {
      const now = new Date();
      const buf = Buffer.alloc(4);
      buf.writeUInt32LE(this.encodeTime(now), 0);
      await zk.executeCmd(CMD_SET_TIME, buf);
      return now;
    });
  }

  async restart(ip: string, port: number): Promise<boolean> {
    try {
      return await this.withConnection(ip, port, async (zk) => {
        await zk.executeCmd(CMD_RESTART, '');
        return true;
      });
    } catch (err: any) {
      this.logger.error(`Restart command failed for ${ip}:${port} -- ${err.message}`);
      return false;
    } finally {
      // The device drops the connection when it restarts either way;
      // clear our cached socket so the next call reconnects cleanly
      // instead of trying (and failing) to reuse a dead one.
      const k = this.key(ip, port);
      const entry = this.connections.get(k);
      if (entry) {
        entry.zk.disconnect().catch(() => undefined);
        this.connections.delete(k);
      }
    }
  }

  async setUser(ip: string, port: number, user: DeviceUser): Promise<boolean> {
    return this.withConnection(ip, port, async (zk) => {
      const uid = this.deriveUid(user.deviceUserId);
      this.checkUidCollision(ip, port, uid, user.deviceUserId);
      const buf = this.encodeUser72(user, uid);
      try {
        // Best-effort: pausing verification while writing prevents a punch
        // landing mid-write on some firmwares. Not every firmware needs or
        // supports this, so failures here are swallowed rather than
        // aborting the write.
        await zk.disableDevice().catch(() => undefined);
        await zk.executeCmd(CMD_USER_WRQ, buf);
      } finally {
        await zk.enableDevice().catch(() => undefined);
      }
      this.logger.log(`Pushed user ${user.deviceUserId} (${user.name}) to ${ip}:${port}`);
      return true;
    });
  }

  async deleteUser(ip: string, port: number, deviceUserId: string): Promise<boolean> {
    return this.withConnection(ip, port, async (zk) => {
      const uid = this.deriveUid(deviceUserId);
      const buf = Buffer.alloc(2);
      buf.writeUInt16LE(uid, 0);
      try {
        await zk.disableDevice().catch(() => undefined);
        await zk.executeCmd(CMD_DELETE_USER, buf);
        // CMD_DELETE_USER removes the base identity record but, on some
        // firmwares, leaves any enrolled fingerprint/face templates
        // behind -- enough for the person to still punch in even though
        // Smart HRM (and the device's own user list) no longer shows
        // them. Strip those too so "deleted" actually means deleted.
        await this.deleteUserTemplates(zk, uid);
        await zk.executeCmd(CMD_REFRESHDATA, '').catch(() => undefined);
      } finally {
        await zk.enableDevice().catch(() => undefined);
      }
      this.logger.log(`Deleted user ${deviceUserId} (uid ${uid}) from ${ip}:${port}`);
      return true;
    });
  }

  async clearTemplates(ip: string, port: number, deviceUserId: string): Promise<boolean> {
    return this.withConnection(ip, port, async (zk) => {
      const uid = this.deriveUid(deviceUserId);
      try {
        await zk.disableDevice().catch(() => undefined);
        await this.deleteUserTemplates(zk, uid);
        await zk.executeCmd(CMD_REFRESHDATA, '').catch(() => undefined);
      } finally {
        await zk.enableDevice().catch(() => undefined);
      }
      this.logger.log(`Cleared biometric templates for user ${deviceUserId} on ${ip}:${port}`);
      return true;
    });
  }

  /**
   * Deletes every enrolled finger template (slots 0-9) for a device uid.
   * Shared by deleteUser() and clearTemplates() -- must be called with an
   * already-open `zk` handle from inside an existing withConnection()
   * callback, never via a fresh withConnection() of its own: this class
   * serializes commands per-connection through a single queue, and a
   * nested withConnection() call on the same connection would await that
   * same queue from inside the callback that's supposed to resolve it,
   * deadlocking forever.
   *
   * CMD_DELETE_USERTEMP payload (uid: uint16 LE, fingerIndex: uint8)
   * matches the widely-referenced pyzk protocol implementation of this
   * same command. Not validated against a real uFace 800 in this
   * environment (no device was reachable) -- test against a spare device
   * before relying on this in production, per the class-level warning.
   * Loops finger slots 0-9 (every slot the terminal can enroll); slots
   * that were never enrolled simply no-op on the device side, so
   * failures per-slot are swallowed rather than aborting the whole clear.
   */
  private async deleteUserTemplates(zk: InstanceType<typeof ZKLib>, uid: number): Promise<void> {
    for (let fingerIndex = 0; fingerIndex <= 9; fingerIndex++) {
      const buf = Buffer.alloc(3);
      buf.writeUInt16LE(uid, 0);
      buf.writeUInt8(fingerIndex, 2);
      await zk.executeCmd(CMD_DELETE_USERTEMP, buf).catch(() => undefined);
    }
  }

  async getAttendanceLogs(ip: string, port: number): Promise<RawPunch[]> {
    return this.withConnection(ip, port, async (zk) => {
      const result = await zk.getAttendances();

      // node-zklib's 40-byte record decoder does not expose verify mode
      // (fingerprint/face/RFID) or in/out direction -- the device firmware
      // does encode these, but this library drops them when parsing.
      // We infer direction heuristically: for each employee, punches are
      // sorted chronologically and alternate IN/OUT starting with IN. This
      // matches how most shifts actually get punched (in, then out) but
      // won't be perfectly accurate for irregular multi-break days.
      const byEmployee = new Map<string, { timestamp: Date }[]>();
      for (const rec of result.data) {
        const list = byEmployee.get(rec.deviceUserId) || [];
        list.push({ timestamp: rec.recordTime });
        byEmployee.set(rec.deviceUserId, list);
      }

      const punches: RawPunch[] = [];
      for (const [deviceUserId, records] of byEmployee.entries()) {
        records.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        records.forEach((r, i) => {
          punches.push({
            deviceUserId,
            timestamp: r.timestamp,
            verifyMode: 'FINGERPRINT', // not exposed by this library; see class docstring
            inOutMode: i % 2 === 0 ? 'IN' : 'OUT',
          });
        });
      }

      return punches;
    });
  }

  // ---------------------------------------------------------------------
  // Protocol encoding helpers
  // ---------------------------------------------------------------------

  /**
   * Warns (does not block) when two different employees hash to the same
   * internal device uid -- the second setUser() call would silently
   * overwrite the first employee's device record. Only catches collisions
   * seen by this process since boot; it's a diagnostic aid, not a
   * guarantee (a fresh restart, or another writer such as the device's own
   * menu, can still assign a colliding uid).
   */
  private checkUidCollision(ip: string, port: number, uid: number, deviceUserId: string) {
    const k = this.key(ip, port);
    if (!this.uidAssignments.has(k)) this.uidAssignments.set(k, new Map());
    const map = this.uidAssignments.get(k)!;
    const existing = map.get(uid);
    if (existing && existing !== deviceUserId) {
      this.logger.warn(
        `Device slot collision on ${ip}:${port}: employees ${existing} and ${deviceUserId} ` +
          `both hash to device uid ${uid} -- this write will overwrite ${existing}'s device ` +
          `record. Give ${deviceUserId} a distinct numeric employeeCode to avoid this.`,
      );
    }
    map.set(uid, deviceUserId);
  }

  /**
   * Builds a 72-byte user record matching the exact layout node-zklib's
   * decodeUserData72() reads:
   *   0-1   uid (uint16 LE)       -- internal device slot number
   *   2     role (uint8)          -- 0 = normal user, 14 = admin
   *   3-10  password (8 bytes)    -- ascii, null-padded
   *   11-34 name (24 bytes)       -- ascii, null-padded
   *   35-38 cardno (uint32 LE)    -- RFID card number
   *   39-47 reserved/group/tz     -- left zeroed
   *   48-56 userId (9 bytes)      -- ascii, null-padded -- this is the
   *                                 PIN/employee number shown on the device
   */
  private encodeUser72(user: DeviceUser, uid: number): Buffer {
    const buf = Buffer.alloc(72, 0);

    buf.writeUInt16LE(uid, 0);
    buf.writeUInt8(0, 2); // role: normal user

    // password left blank (offset 3-10)

    buf.write(user.name.slice(0, 24), 11, 'ascii');

    const cardNumber = user.cardNumber ? parseInt(user.cardNumber, 10) : 0;
    buf.writeUInt32LE(Number.isFinite(cardNumber) ? cardNumber : 0, 35);

    buf.write(user.deviceUserId.slice(0, 9), 48, 'ascii');

    return buf;
  }

  /**
   * The device's internal uid is a uint16 (0-65535), while our
   * deviceUserId (employeeCode / PIN) can be any string. When the PIN is
   * purely numeric and fits in 16 bits, we reuse it directly as the uid
   * so the two stay predictable and human-traceable on the device menu.
   * Otherwise we derive a stable uid via a simple hash so the same
   * employee always maps to the same device slot. Hash collisions between
   * two different employees are possible (birthday-paradox territory once
   * you have a few hundred non-numeric IDs) -- see checkUidCollision().
   */
  private deriveUid(deviceUserId: string): number {
    const numeric = Number(deviceUserId.replace(/\D/g, ''));
    if (Number.isFinite(numeric) && numeric > 0 && numeric <= 65535) {
      return numeric;
    }
    let hash = 0;
    for (let i = 0; i < deviceUserId.length; i++) {
      hash = (hash * 31 + deviceUserId.charCodeAt(i)) % 65535;
    }
    return hash + 1; // avoid uid 0
  }

  /** Inverse of node-zklib's parseTimeToDate() (utils.js). */
  private encodeTime(date: Date): number {
    const year = date.getFullYear() - 2000;
    const month = date.getMonth();
    const day = date.getDate() - 1;
    const hour = date.getHours();
    const minute = date.getMinutes();
    const second = date.getSeconds();

    return (
      ((((year * 12 + month) * 31 + day) * 24 + hour) * 60 + minute) * 60 + second
    );
  }

  private async readDeviceTime(zk: InstanceType<typeof ZKLib>): Promise<Date> {
    try {
      const data = await zk.executeCmd(CMD_GET_TIME, '');
      const encoded = data.readUInt32LE(0);
      return this.decodeTime(encoded);
    } catch {
      return new Date();
    }
  }

  private decodeTime(time: number): Date {
    const second = time % 60;
    time = (time - second) / 60;
    const minute = time % 60;
    time = (time - minute) / 60;
    const hour = time % 24;
    time = (time - hour) / 24;
    const day = (time % 31) + 1;
    time = (time - (day - 1)) / 31;
    const month = time % 12;
    time = (time - month) / 12;
    const year = time + 2000;
    return new Date(year, month, day, hour, minute, second);
  }
}
