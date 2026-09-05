'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  Fingerprint,
  Plug,
  PlugZap,
  RotateCw,
  Clock,
  Info,
  Plus,
  RefreshCcw,
  ListRestart,
  Users,
  Pencil,
  DownloadCloud,
  Trash2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusPill, Badge } from '@/components/ui/Card';
import { Table, Thead, Tbody, Tr, Th, Td, EmptyState } from '@/components/ui/Table';
import { AddDeviceModal } from '@/components/devices/AddDeviceModal';
import {
  useDevices,
  useDeviceAction,
  useTestConnection,
  useDeviceInfo,
  useDeviceUsers,
  useImportDeviceUsers,
  useDeleteDevice,
  useDeviceLogs,
  useBulkSync,
  useRetryFailedSync,
  useSyncHistory,
} from '@/hooks/useDevices';
import { apiErrorMessage } from '@/lib/api';
import { deviceStatusColors, syncStatusColors, formatDateTime } from '@/lib/utils';
import { Device, DeviceUser } from '@/types';

function DeviceCard({ device, onEdit }: { device: Device; onEdit: (device: Device) => void }) {
  const connect = useDeviceAction('connect');
  const disconnect = useDeviceAction('disconnect');
  const restart = useDeviceAction('restart');
  const syncTime = useDeviceAction('sync-time');
  const testConnection = useTestConnection();
  const deviceInfo = useDeviceInfo();
  const deviceUsers = useDeviceUsers();
  const importUsers = useImportDeviceUsers();
  const deleteDevice = useDeleteDevice();
  const { data: logs } = useDeviceLogs(device.id);

  const [info, setInfo] = useState<any>(null);
  const [users, setUsers] = useState<DeviceUser[] | null>(null);
  const colors = deviceStatusColors[device.connectionStatus];

  async function run(action: 'connect' | 'disconnect' | 'restart' | 'sync-time', mutation: any, label: string) {
    try {
      await mutation.mutateAsync(device.id);
      toast.success(label);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleTest() {
    try {
      const res = await testConnection.mutateAsync(device.id);
      toast[res.reachable ? 'success' : 'error'](res.reachable ? 'Device reachable' : 'Device unreachable');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleInfo() {
    try {
      const res = await deviceInfo.mutateAsync(device.id);
      setInfo(res);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleUsers() {
    try {
      const res = await deviceUsers.mutateAsync(device.id);
      setUsers(res);
      if (res.length === 0) toast('No users enrolled on this device yet');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleImport() {
    try {
      const res = await importUsers.mutateAsync(device.id);
      toast.success(`Imported ${res.imported} new employee(s), skipped ${res.skipped} already linked (${res.total} total on device)`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        `Remove "${device.name}" (${device.ipAddress}:${device.port})? This does not affect the physical terminal, but employees will need to be re-synced once you add a device again.`,
      )
    )
      return;
    try {
      await deleteDevice.mutateAsync(device.id);
      toast.success('Device removed');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-ink text-white">
            <Fingerprint className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-text-primary">{device.name}</p>
            <p className="text-xs text-text-muted">{device.deviceModel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill label={device.connectionStatus} colors={colors} pulsing={device.connectionStatus === 'ONLINE'} />
          <button
            onClick={() => onEdit(device)}
            className="rounded-md p-1.5 text-text-muted hover:bg-surface-sunken hover:text-text-primary"
            title="Edit device"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteDevice.isPending}
            className="rounded-md p-1.5 text-text-muted hover:bg-danger-soft hover:text-danger disabled:opacity-50"
            title="Delete device"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-text-muted">IP Address</p>
          <p className="font-mono text-text-primary">{device.ipAddress}:{device.port}</p>
        </div>
        <div>
          <p className="text-text-muted">Serial Number</p>
          <p className="font-mono text-text-primary">{device.serialNumber || '—'}</p>
        </div>
        <div>
          <p className="text-text-muted">Firmware</p>
          <p className="text-text-primary">{device.firmwareVersion || '—'}</p>
        </div>
        <div>
          <p className="text-text-muted">Last Communication</p>
          <p className="text-text-primary">{formatDateTime(device.lastCommunication)}</p>
        </div>
      </div>

      {info && (
        <div className="mt-4 rounded-lg bg-surface-sunken/60 p-3 text-xs space-y-1">
          <p>Users on device: <span className="font-medium">{info.userCount}</span></p>
          <p>Fingerprint enrollments: <span className="font-medium">{info.fingerprintCount}</span></p>
          <p>Face enrollments: <span className="font-medium">{info.faceCount}</span></p>
          <p>Storage used: <span className="font-medium">{info.storageUsedPercent}%</span></p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => run('connect', connect, 'Connected')} loading={connect.isPending}>
          <Plug className="h-3.5 w-3.5" /> Connect
        </Button>
        <Button size="sm" variant="outline" onClick={() => run('disconnect', disconnect, 'Disconnected')} loading={disconnect.isPending}>
          <PlugZap className="h-3.5 w-3.5" /> Disconnect
        </Button>
        <Button size="sm" variant="outline" onClick={handleTest} loading={testConnection.isPending}>
          Test Connection
        </Button>
        <Button size="sm" variant="outline" onClick={() => run('restart', restart, 'Restart command sent')} loading={restart.isPending}>
          <RotateCw className="h-3.5 w-3.5" /> Restart
        </Button>
        <Button size="sm" variant="outline" onClick={() => run('sync-time', syncTime, 'Clock synchronized')} loading={syncTime.isPending}>
          <Clock className="h-3.5 w-3.5" /> Sync Time
        </Button>
        <Button size="sm" variant="outline" onClick={handleInfo} loading={deviceInfo.isPending}>
          <Info className="h-3.5 w-3.5" /> Device Info
        </Button>
        <Button size="sm" variant="outline" onClick={handleUsers} loading={deviceUsers.isPending}>
          <Users className="h-3.5 w-3.5" /> View Enrolled Users
        </Button>
        <Button size="sm" variant="outline" onClick={handleImport} loading={importUsers.isPending}>
          <DownloadCloud className="h-3.5 w-3.5" /> Import to HRM
        </Button>
      </div>

      {users && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-xs font-medium text-text-secondary mb-2">
            Enrolled on device ({users.length})
          </p>
          {users.length === 0 ? (
            <p className="text-xs text-text-muted">No users enrolled on this device yet.</p>
          ) : (
            <div className="max-h-56 overflow-y-auto rounded-lg border border-line">
              <Table>
                <Thead>
                  <tr>
                    <Th>Device User ID</Th>
                    <Th>Name</Th>
                    <Th>Card #</Th>
                    <Th>Fingerprint</Th>
                    <Th>Face</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {users.map((u) => (
                    <Tr key={u.deviceUserId}>
                      <Td className="font-mono text-xs">{u.deviceUserId}</Td>
                      <Td>{u.name}</Td>
                      <Td>{u.cardNumber || '—'}</Td>
                      <Td>{u.hasFingerprint ? 'Yes' : 'No'}</Td>
                      <Td>{u.hasFace ? 'Yes' : 'No'}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </div>
          )}
        </div>
      )}

      {logs && logs.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-xs font-medium text-text-secondary mb-2">Recent Device Logs</p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {logs.slice(0, 8).map((log: any) => (
              <div key={log.id} className="flex items-center gap-2 text-xs">
                <Badge
                  className={
                    log.level === 'ERROR'
                      ? 'bg-danger-soft text-danger'
                      : log.level === 'WARNING'
                        ? 'bg-warning-soft text-warning'
                        : ''
                  }
                >
                  {log.level}
                </Badge>
                <span className="text-text-secondary">{log.message}</span>
                <span className="ml-auto text-text-muted">{formatDateTime(log.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function DevicePage() {
  const { data: devices, isLoading } = useDevices();
  const { data: syncHistory } = useSyncHistory();
  const bulkSync = useBulkSync();
  const retryFailed = useRetryFailedSync();
  const [addOpen, setAddOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);

  async function handleBulkSync() {
    try {
      const res = await bulkSync.mutateAsync();
      toast.success(`Synced ${res.total} employees`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  async function handleRetry() {
    try {
      const res = await retryFailed.mutateAsync();
      toast.success(`Retried ${res.retried} failed syncs`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <AppShell title="Device Management" subtitle="Control your ZKTeco uFace 800 Plus and employee synchronization">
      {isLoading && <p className="text-sm text-text-secondary">Loading device...</p>}

      {!isLoading && (devices?.length ?? 0) === 0 && (
        <Card className="p-10">
          <EmptyState
            icon={<Fingerprint className="h-8 w-8" />}
            title="No biometric device configured"
            subtitle="Add your ZKTeco uFace 800 Plus to start synchronizing employees and attendance."
          />
          <div className="flex justify-center">
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              Add Device
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {devices?.map((device) => (
          <DeviceCard key={device.id} device={device} onEdit={setEditingDevice} />
        ))}
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Employee Synchronization"
          subtitle="Push HRM employee records out to the biometric device"
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleRetry} loading={retryFailed.isPending}>
                <ListRestart className="h-3.5 w-3.5" /> Retry Failed
              </Button>
              <Button size="sm" onClick={handleBulkSync} loading={bulkSync.isPending}>
                <RefreshCcw className="h-3.5 w-3.5" /> Bulk Sync All
              </Button>
            </div>
          }
        />
        <Table>
          <Thead>
            <tr>
              <Th>Employee</Th>
              <Th>Device</Th>
              <Th>Operation</Th>
              <Th>Status</Th>
              <Th>Message</Th>
              <Th>Time</Th>
            </tr>
          </Thead>
          <Tbody>
            {syncHistory?.slice(0, 20).map((h: any) => (
              <Tr key={h.id}>
                <Td>{h.employee ? `${h.employee.fullName} (${h.employee.employeeCode})` : '—'}</Td>
                <Td>{h.device?.name || '—'}</Td>
                <Td>
                  <Badge>{h.operation}</Badge>
                </Td>
                <Td>
                  <StatusPill
                    label={h.status}
                    colors={
                      h.status === 'SUCCESS'
                        ? syncStatusColors.SYNCED
                        : h.status === 'FAILED'
                          ? syncStatusColors.FAILED
                          : syncStatusColors.PENDING
                    }
                  />
                </Td>
                <Td className="text-xs text-text-secondary max-w-xs truncate">{h.message || '—'}</Td>
                <Td className="text-xs">{formatDateTime(h.createdAt)}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
        {(syncHistory?.length ?? 0) === 0 && (
          <EmptyState title="No synchronization activity yet" />
        )}
      </Card>

      <AddDeviceModal open={addOpen} onClose={() => setAddOpen(false)} />
      <AddDeviceModal open={!!editingDevice} onClose={() => setEditingDevice(null)} device={editingDevice} />
    </AppShell>
  );
}
