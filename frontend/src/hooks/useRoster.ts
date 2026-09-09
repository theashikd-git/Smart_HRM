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

export interface UpsertRosterPayload {
  employeeId: string;
  date: string;
  type: RosterDayType;
  shiftId?: string;
}

export function useUpsertRosterAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ employeeId, date, type, shiftId }: UpsertRosterPayload) =>
      (await api.put(`/roster/${employeeId}/${date}`, { type, shiftId })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roster'] }),
  });
}

export function useClearRosterAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ employeeId, date }: { employeeId: string; date: string }) =>
      (await api.delete(`/roster/${employeeId}/${date}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roster'] }),
  });
}
