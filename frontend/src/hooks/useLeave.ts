import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { LeaveBalance, LeaveRequest, LeaveType, Paginated } from '@/types';

export interface LeaveQuery {
  employeeId?: string;
  departmentId?: string;
  leaveTypeId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

// -- Leave types ------------------------------------------------------------

export function useLeaveTypes(includeInactive = false) {
  return useQuery({
    queryKey: ['leave-types', includeInactive],
    queryFn: async () =>
      (await api.get<LeaveType[]>('/leave-types', { params: { includeInactive } })).data,
  });
}

export function useCreateLeaveType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<LeaveType>) => (await api.post('/leave-types', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-types'] }),
  });
}

export function useUpdateLeaveType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<LeaveType>) =>
      (await api.patch(`/leave-types/${id}`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-types'] }),
  });
}

export function useDeactivateLeaveType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/leave-types/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-types'] }),
  });
}

// -- Leave requests -----------------------------------------------------------

export function useLeaveRequests(query: LeaveQuery) {
  return useQuery({
    queryKey: ['leave-requests', query],
    queryFn: async () =>
      (await api.get<Paginated<LeaveRequest>>('/leave/requests', { params: query })).data,
  });
}

export function useLeaveRequest(id?: string) {
  return useQuery({
    queryKey: ['leave-request', id],
    queryFn: async () => (await api.get<LeaveRequest>(`/leave/requests/${id}`)).data,
    enabled: !!id,
  });
}

export function useCreateLeaveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      employeeId: string;
      leaveTypeId: string;
      startDate: string;
      endDate: string;
      session?: string;
      reason?: string;
      overrideBalance?: boolean;
    }) => (await api.post('/leave/requests', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave-requests'] });
      qc.invalidateQueries({ queryKey: ['leave-balances'] });
      qc.invalidateQueries({ queryKey: ['leave-pending-count'] });
    },
  });
}

export function useApproveLeaveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.patch(`/leave/requests/${id}/approve`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave-requests'] });
      qc.invalidateQueries({ queryKey: ['leave-balances'] });
      qc.invalidateQueries({ queryKey: ['leave-pending-count'] });
      qc.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
}

export function useRejectLeaveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      (await api.patch(`/leave/requests/${id}/reject`, { reason })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave-requests'] });
      qc.invalidateQueries({ queryKey: ['leave-pending-count'] });
    },
  });
}

export function useCancelLeaveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.patch(`/leave/requests/${id}/cancel`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave-requests'] });
      qc.invalidateQueries({ queryKey: ['leave-balances'] });
      qc.invalidateQueries({ queryKey: ['attendance'] });
    },
  });
}

export function useLeavePendingCount() {
  return useQuery({
    queryKey: ['leave-pending-count'],
    queryFn: async () => (await api.get<number>('/leave/pending-count')).data,
  });
}

// -- Balances -----------------------------------------------------------------

export function useLeaveBalances(employeeId?: string, year?: number) {
  return useQuery({
    queryKey: ['leave-balances', employeeId, year],
    queryFn: async () =>
      (await api.get<LeaveBalance[]>(`/leave/balances/${employeeId}`, { params: { year } })).data,
    enabled: !!employeeId,
  });
}

export function useAdjustLeaveBalance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      employeeId: string;
      leaveTypeId: string;
      year?: number;
      allocated?: number;
      carriedForward?: number;
      note?: string;
    }) => (await api.post('/leave/balances/adjust', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-balances'] }),
  });
}

export function useInitializeLeaveBalances() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { year?: number; leaveTypeId?: string }) =>
      (await api.post('/leave/balances/initialize', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-balances'] }),
  });
}

// -- Calendar -------------------------------------------------------------

export function useLeaveCalendar(from?: string, to?: string, departmentId?: string) {
  return useQuery({
    queryKey: ['leave-calendar', from, to, departmentId],
    queryFn: async () =>
      (await api.get<LeaveRequest[]>('/leave/calendar', { params: { from, to, departmentId } })).data,
    enabled: !!from && !!to,
  });
}


// -- Employee self-service (Employee portal) ---------------------------------
// Every request below is implicitly scoped to the signed-in employee's own
// record on the backend (via their linked User.employeeId) -- there is no
// employeeId to pass here, unlike the HR-facing hooks above.

export function useMyLeaveRequests() {
  return useQuery({
    queryKey: ['my-leave-requests'],
    queryFn: async () => (await api.get<LeaveRequest[]>('/leave/my/requests')).data,
  });
}

export function useMyLeaveBalances(year?: number) {
  return useQuery({
    queryKey: ['my-leave-balances', year],
    queryFn: async () => (await api.get<LeaveBalance[]>('/leave/my/balances', { params: { year } })).data,
  });
}

export function useCreateMyLeaveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      leaveTypeId: string;
      startDate: string;
      endDate: string;
      session?: string;
      reason?: string;
    }) => (await api.post('/leave/my/requests', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-leave-requests'] });
      qc.invalidateQueries({ queryKey: ['my-leave-balances'] });
    },
  });
}

export function useCancelMyLeaveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.patch(`/leave/my/requests/${id}/cancel`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-leave-requests'] });
      qc.invalidateQueries({ queryKey: ['my-leave-balances'] });
    },
  });
}
