import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AttendanceRecord, Paginated } from '@/types';

export interface AttendanceQuery {
  employeeId?: string;
  departmentId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export function useAttendance(query: AttendanceQuery) {
  return useQuery({
    queryKey: ['attendance', query],
    queryFn: async () =>
      (await api.get<Paginated<AttendanceRecord>>('/attendance', { params: query })).data,
  });
}

export function useMissingPunches() {
  return useQuery({
    queryKey: ['attendance-missing'],
    queryFn: async () => (await api.get<AttendanceRecord[]>('/attendance/missing-punches')).data,
  });
}

export function useSyncAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post('/attendance/sync')).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['attendance-missing'] });
    },
  });
}

export function useManualPunch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { employeeId: string; timestamp: string; direction: 'IN' | 'OUT' }) =>
      (await api.post('/attendance/manual-punch', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance'] }),
  });
}

export function useCorrectAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: {
      id: string;
      checkIn?: string;
      checkOut?: string;
      status?: string;
      notes?: string;
    }) => (await api.patch(`/attendance/${id}/correct`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance'] }),
  });
}

export function useApproveAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) =>
      (await api.patch(`/attendance/${id}/approve`, { approved })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['attendance'] }),
  });
}
