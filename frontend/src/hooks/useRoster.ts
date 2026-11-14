import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PendingRosterItem, RosterAssignment, RosterDayType, RosterWeekData } from '@/types';

export interface RosterWeekQuery {
  startDate: string;
  endDate: string;
  departmentId?: string;
}

export function useRosterWeek(query: RosterWeekQuery) {
  return useQuery({
    queryKey: ['roster', query],
    queryFn: async () => (await api.get<RosterWeekData>('/roster', { params: query })).data,
  });
}

export interface MyRosterQuery {
  startDate: string;
  endDate: string;
}

export function useMyRoster(query: MyRosterQuery) {
  return useQuery({
    queryKey: ['my-roster', query],
    queryFn: async () => (await api.get<{ assignments: RosterAssignment[] }>('/roster/mine', { params: query })).data,
  });
}

/** Dashboard widget helper (Pending Approvals -- "Roster Changes" row):
 *  count of duties awaiting an HR/Admin decision. */
export function useRosterPendingCount() {
  return useQuery({
    queryKey: ['roster-pending-count'],
    queryFn: async () => (await api.get<number>('/roster/pending-count')).data,
  });
}

export interface UpsertRosterPayload {
  employeeId: string;
  date: string;
  type: RosterDayType;
  shiftId?: string;
  // Only required by the backend when the date being assigned has
  // already passed (see RosterService.upsert).
  hrNote?: string;
}

export function useUpsertRosterAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ employeeId, date, type, shiftId, hrNote }: UpsertRosterPayload) =>
      (await api.put(`/roster/${employeeId}/${date}`, { type, shiftId, hrNote })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roster'] });
      qc.invalidateQueries({ queryKey: ['my-roster'] });
      qc.invalidateQueries({ queryKey: ['roster-pending-count'] });
    },
  });
}

export interface ApproveRosterPayload {
  employeeId: string;
  date: string;
  note?: string;
}

/** HR/Admin confirms a Manager's still-PENDING duty -- only after this
 *  does it show up on the employee's own "My Calendar". */
export function useApproveRosterAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ employeeId, date, note }: ApproveRosterPayload) =>
      (await api.patch(`/roster/${employeeId}/${date}/approve`, { note })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roster'] });
      qc.invalidateQueries({ queryKey: ['my-roster'] });
      qc.invalidateQueries({ queryKey: ['roster-pending-count'] });
    },
  });
}

export interface ClearRosterPayload {
  employeeId: string;
  date: string;
  // Only required by the backend when the date being cleared has already
  // passed (see RosterService.remove).
  hrNote?: string;
}

export function useClearRosterAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ employeeId, date, hrNote }: ClearRosterPayload) =>
      (await api.delete(`/roster/${employeeId}/${date}`, { data: { hrNote } })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roster'] });
      qc.invalidateQueries({ queryKey: ['my-roster'] });
      qc.invalidateQueries({ queryKey: ['roster-pending-count'] });
    },
  });
}

/** One staged edit from the Roster screen, sent on Save. */
export interface RosterChange {
  employeeId: string;
  date: string;
  action: 'SET' | 'CLEAR';
  type?: RosterDayType;
  shiftId?: string;
  // Required by the backend for a date that has already passed.
  hrNote?: string;
}

export interface BatchRosterResult {
  applied: number;
  pending: number;
  failed: { employeeId: string; date: string; message: string }[];
}

/** "Save" on the Roster screen -- sends every staged change in one
 *  request (POST /roster/batch). */
export function useSaveRosterBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (changes: RosterChange[]) =>
      (await api.post<BatchRosterResult>('/roster/batch', { changes })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roster'] });
      qc.invalidateQueries({ queryKey: ['my-roster'] });
      qc.invalidateQueries({ queryKey: ['roster-pending-count'] });
    },
  });
}

/** Roster Approvals screen: everything waiting on HR/Admin. Keyed under
 *  'roster' so every roster change/approve/reject refreshes it too. */
export function useRosterPendingList() {
  return useQuery({
    queryKey: ['roster', 'pending'],
    queryFn: async () => (await api.get<PendingRosterItem[]>('/roster/pending')).data,
    refetchInterval: 30_000,
  });
}

/** HR/Admin turns a pending change / clear request down. */
export function useRejectRosterAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ employeeId, date, note }: ApproveRosterPayload) =>
      (await api.patch(`/roster/${employeeId}/${date}/reject`, { note })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roster'] });
      qc.invalidateQueries({ queryKey: ['my-roster'] });
      qc.invalidateQueries({ queryKey: ['roster-pending-count'] });
    },
  });
}
