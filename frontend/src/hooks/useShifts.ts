import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Shift } from '@/types';

export interface ShiftPayload {
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes?: number;
  breakMinutes?: number;
  weekendRule?: string;
  overtimeRule?: string;
}

export function useShifts() {
  return useQuery({
    queryKey: ['shifts'],
    queryFn: async () => (await api.get<Shift[]>('/shifts')).data,
  });
}

export function useCreateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ShiftPayload) => (await api.post('/shifts', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
  });
}

export function useUpdateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: ShiftPayload & { id: string }) =>
      (await api.patch(`/shifts/${id}`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
  });
}

export function useDeleteShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/shifts/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
  });
}
