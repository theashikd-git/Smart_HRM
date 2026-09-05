/**
 * Injection token for the active ZktecoClient implementation.
 * Bound in devices.module.ts to either ZktecoMockClient (default, safe,
 * no hardware required) or ZktecoRealClient (talks to a real ZKTeco
 * device over TCP), controlled by the ZKTECO_DRIVER env var.
 */
export const ZKTECO_CLIENT = 'ZKTECO_CLIENT';
