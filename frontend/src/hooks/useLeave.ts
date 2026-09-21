import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { EmployeeCategory, LeaveBalance, LeaveCategoryPolicy, LeaveRequest, LeaveType, Paginated } from '@/types';

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

// -- Employee categories -------------------------------------------------------
// Permanent/Provision/Contractual/Trial by default -- HR can add new ones or
// rename existing ones from the Leave Policy screen (Personnel > Leave
// Management). Employee.leaveCategoryId and LeaveCategoryPolicy.leaveCategoryId
// both point at these rows.

export function useEmployeeCategories(includeInactive = false) {
  return useQuery({
    queryKey: ['employee-categories', includeInactive],
    queryFn: async () =>
      (await api.get<EmployeeCategory[]>('/employee-categories', { params: { includeInactive } })).data,
  });
}

export function useCreateEmployeeCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      accruesRollover?: boolean;
      hasFixedPeriod?: boolean;
      defaultPeriodMonths?: number;
    }) => (await api.post('/employee-categories', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employee-categories'] }),
  });
}

export function useUpdateEmployeeCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: {
      id: string;
      name?: string;
      accruesRollover?: boolean;
      hasFixedPeriod?: boolean;
      defaultPeriodMonths?: number;
    }) => (await api.patch(`/employee-categories/${id}`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employee-categories'] }),
  });
}

export function useDeactivateEmployeeCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/employee-categories/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employee-categories'] }),
  });
}

// -- Leave category policies --------------------------------------------------
// Per (employee category, leave type) entitlements -- Personnel > Leave
// Management > Leave Policy.

export function useLeaveCategoryPolicies(leaveCategoryId?: string) {
  return useQuery({
    queryKey: ['leave-category-policies', leaveCategoryId],
    queryFn: async () =>
      (await api.get<LeaveCategoryPolicy[]>('/leave-category-policies', { params: { leaveCategoryId } })).data,
  });
}

export function useCreateLeaveCategoryPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      leaveCategoryId: string;
      leaveTypeId: string;
      daysPerCycle: number;
      carryForward?: boolean;
      maxCarryForwardDays?: number;
      carryForwardOnce?: boolean;
    }) => (await api.post('/leave-category-policies', payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-category-policies'] }),
  });
}

export function useUpdateLeaveCategoryPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: {
      id: string;
      daysPerCycle?: number;
      carryForward?: boolean;
      maxCarryForwardDays?: number;
      carryForwardOnce?: boolean;
    }) => (await api.patch(`/leave-category-policies/${id}`, payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-category-policies'] }),
  });
}

export function useDeleteLeaveCategoryPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/leave-category-policies/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leave-category-policies'] }),
  });
}

// One-step "+ Add Leave" under an employee-category section -- names a leave
// (existing or brand new) and its entitlement in a single call, instead of
// requiring a separate trip to the Leave Type screen first.
export function useQuickAddLeaveCategoryPolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      leaveCategoryId: string;
      leaveName: string;
      daysPerCycle: number;
      carryForward?: boolean;
      maxCarryForwardDays?: number;
      carryForwardOnce?: boolean;
    }) => (await api.post('/leave-category-policies/quick-add', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave-category-policies'] });
      qc.invalidateQueries({ queryKey: ['leave-types'] });
    },
  });
}

// -- Leave attachments (Maternity Leave's required supporting document) -----

export function useUploadLeaveAttachment() {
  return useMutation({
    mutationFn: async ({ file, employeeId }: { file: File; employeeId?: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (employeeId) formData.append('employeeId', employeeId);
      return (await api.post<{ id: string; fileName: string }>('/leave/attachments', formData)).data;
    },
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
      compensatoryForDate?: string;
      attachmentId?: string;
    }) => (await api.post('/leave/requests', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave-requests'] });
      qc.invalidateQueries({ queryKey: ['leave-balances'] });
      qc.invalidateQueries({ queryKey: ['leave-pending-count'] });
      qc.invalidateQueries({ queryKey: ['leave-applied-on-behalf'] });
    },
  });
}

// Every request the signed-in login has filed for someone else (never for
// themselves) -- powers the Manager Portal's "Leave on Behalf" tab. See
// LeaveController.findAppliedOnBehalf.
export function useAppliedOnBehalf() {
  return useQuery({
    queryKey: ['leave-applied-on-behalf'],
    queryFn: async () => (await api.get<LeaveRequest[]>('/leave/my-team/on-behalf')).data,
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
      qc.invalidateQueries({ queryKey: ['my-approvals'] });
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
      qc.invalidateQueries({ queryKey: ['my-approvals'] });
    },
  });
}

// -- Leave cancellation approval (cancelling an already-APPROVED leave) -----
// Deciding the CURRENT tier of a request's cancellation chain -- distinct
// from useApproveLeaveRequest/useRejectLeaveRequest above, which decide the
// original approval chain. See LeaveService.approveCancellation/
// rejectCancellation.

export function useApproveCancellation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.patch(`/leave/requests/${id}/approve-cancellation`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave-requests'] });
      qc.invalidateQueries({ queryKey: ['leave-balances'] });
      qc.invalidateQueries({ queryKey: ['attendance'] });
      qc.invalidateQueries({ queryKey: ['my-approvals'] });
      qc.invalidateQueries({ queryKey: ['my-leave-requests'] });
    },
  });
}

export function useRejectCancellation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      (await api.patch(`/leave/requests/${id}/reject-cancellation`, { reason })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave-requests'] });
      qc.invalidateQueries({ queryKey: ['my-approvals'] });
      qc.invalidateQueries({ queryKey: ['my-leave-requests'] });
    },
  });
}

// Every request the signed-in login can act on right now, plus the record
// of what it has approved/rejected before (see LeaveController /
// LeaveService.findMyApprovals for the canDecide flag) -- powers the "Leave
// Request" tab on both the Employee Portal and the Manager Portal.
// Distinct from useMyLeaveRequests (that login's own leave, as an
// applicant) and from the staff-only /leave list.
export function useMyApprovals() {
  return useQuery({
    queryKey: ['my-approvals'],
    queryFn: async () => (await api.get<LeaveRequest[]>('/leave/my/approvals')).data,
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

export interface InitializeLeaveBalancesResult {
  year: number;
  employeesConsidered: number;
  leaveTypesConsidered: number;
  created: number;
  skippedNoPolicy: number;
}

// Backfills the actual LeaveBalance rows employee portals read from, from
// whatever LeaveCategoryPolicy rows HR has configured -- without this,
// configuring a policy (or adding/moving an employee into a category)
// doesn't by itself grant anything, and the portal just shows "0 day(s)
// remaining". Safe to re-run any time: only fills in rows that don't exist
// yet for the given year, never overwrites an existing balance.
export function useInitializeLeaveBalances() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { year?: number; leaveTypeId?: string; employeeId?: string }) =>
      (await api.post<InitializeLeaveBalancesResult>('/leave/balances/initialize', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave-balances'] });
      qc.invalidateQueries({ queryKey: ['my-leave-balances'] });
    },
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

// Only the leave types this employee is actually eligible for (their own
// employee category's configured policy, plus special-rule types everyone
// can apply for) -- what the Apply for Leave dropdown should offer, instead
// of useLeaveTypes()'s full unfiltered list.
export function useMyEligibleLeaveTypes() {
  return useQuery({
    queryKey: ['my-eligible-leave-types'],
    queryFn: async () => (await api.get<LeaveType[]>('/leave/my/leave-types')).data,
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
      compensatoryForDate?: string;
      attachmentId?: string;
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
    mutationFn: async (payload: string | { id: string; reason?: string }) => {
      const { id, reason } = typeof payload === 'string' ? { id: payload, reason: undefined } : payload;
      return (await api.patch(`/leave/my/requests/${id}/cancel`, reason ? { reason } : undefined)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-leave-requests'] });
      qc.invalidateQueries({ queryKey: ['my-leave-balances'] });
    },
  });
}
