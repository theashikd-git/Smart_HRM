import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { RosterAssignment, RosterDayType, RosterWeekData } from '@/types';

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
  // Only required by the backend when changing an assignment that's
  // already APPROVED -- an HR/Admin override of something a Manager can
  // no longer touch (see RosterService.upsert).
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
  // Only required by the backend when clearing an assignment that's
  // already APPROVED (see RosterService.remove).
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
