import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AttendancePolicy, PolicyAbsenceRow, PolicyCounter, PolicyPayload } from '@/types/policy';

export function usePolicies() {
  return useQuery({
    queryKey: ['policies'],
    queryFn: async () => (await api.get<AttendancePolicy[]>('/policies')).data,
  });
}

export function useCreatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: PolicyPayload) => (await api.post('/policies', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['policies'] }),
  });
}

export function useUpdatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<PolicyPayload> & { id: string }) =>
      (await api.patch(`/policies/${id}`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['policies'] }),
  });
}

export function useActivatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, effectiveFrom }: { id: string; effectiveFrom?: string }) =>
      (await api.post(`/policies/${id}/activate`, { effectiveFrom })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['policies'] }),
  });
}

export function useDeactivatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, effectiveTo }: { id: string; effectiveTo?: string }) =>
      (await api.post(`/policies/${id}/deactivate`, { effectiveTo })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['policies'] }),
  });
}

/** The explicit "recalculate from date" action: re-runs the daily rules from raw punches. */
export function useRecalculateAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { fromDate: string; employeeId?: string }) =>
      (await api.post<{ fromDate: string; recalculated: number; skippedCorrected: number }>('/attendance/recalculate', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attendance'] });
      qc.invalidateQueries({ queryKey: ['reports'] });
      qc.invalidateQueries({ queryKey: ['policy-absences'] });
    },
  });
}

export function usePolicyAbsences(params: { employeeId?: string; departmentId?: string; startDate?: string; endDate?: string }, enabled = true) {
  return useQuery({
    queryKey: ['policy-absences', params],
    enabled,
    queryFn: async () => (await api.get<PolicyAbsenceRow[]>('/policies/absences', { params })).data,
  });
}

export function usePolicyCounters(employeeId?: string) {
  return useQuery({
    queryKey: ['policy-counters', employeeId],
    enabled: !!employeeId,
    queryFn: async () =>
      (await api.get<{ exempt: boolean; counters: PolicyCounter[] }>('/policies/counters', { params: { employeeId } })).data,
  });
}
