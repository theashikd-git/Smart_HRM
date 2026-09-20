import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Device, DeviceUser } from '@/types';

export function useDevices() {
  return useQuery({
    queryKey: ['devices'],
    queryFn: async () => (await api.get<Device[]>('/devices')).data,
  });
}

export function useDeviceLogs(id?: string) {
  return useQuery({
    queryKey: ['device-logs', id],
    queryFn: async () => (await api.get(`/devices/${id}/logs`)).data,
    enabled: !!id,
  });
}

export function useSyncHistory(employeeId?: string) {
  return useQuery({
    queryKey: ['sync-history', employeeId],
    queryFn: async () =>
      (await api.get('/devices/sync/history', { params: employeeId ? { employeeId } : {} })).data,
  });
}

export function useCreateDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; ipAddress: string; port?: number }) =>
      (await api.post('/devices', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devices'] });
      // Adding a device kicks off a background pull of everyone already
      // enrolled on it (see DeviceSyncService.importFromDeviceOnAdd) --
      // it isn't awaited by the create call itself, so give it a few
      // seconds to finish talking to the device and then refresh the
      // lists it affects. Harmless no-op if nothing changed yet.
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['employees'] });
        qc.invalidateQueries({ queryKey: ['sync-history'] });
      }, 6000);
    },
  });
}

export function useUpdateDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; name?: string; ipAddress?: string; port?: number }) =>
      (await api.patch(`/devices/${id}`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['devices'] }),
  });
}

export function useDeleteDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/devices/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['devices'] }),
  });
}

export function useDeviceAction(action: 'connect' | 'disconnect' | 'restart' | 'sync-time') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/devices/${id}/${action}`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devices'] });
      qc.invalidateQueries({ queryKey: ['device-logs'] });
    },
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: async (id: string) => (await api.get(`/devices/${id}/test-connection`)).data,
  });
}

export function useDeviceInfo() {
  return useMutation({
    mutationFn: async (id: string) => (await api.get(`/devices/${id}/info`)).data,
  });
}

export function useDeviceUsers() {
  return useMutation({
    mutationFn: async (id: string) => (await api.get<DeviceUser[]>(`/devices/${id}/users`)).data,
  });
}

export function useImportDeviceUsers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.post<{ total: number; imported: number; skipped: number; loginsCreated: number; loginFailures: number }>(`/devices/${id}/import-users`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['sync-history'] });
    },
  });
}

export function useBulkSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post('/devices/sync/bulk')).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['sync-history'] });
    },
  });
}

export function useRetryFailedSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post('/devices/sync/retry-failed')).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['sync-history'] });
    },
  });
}
