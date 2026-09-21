import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DashboardSummary, MyTeamAttendance, MyTeamOnLeave, MyTeamRecentPunches } from '@/types';

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => (await api.get<DashboardSummary>('/dashboard/summary')).data,
    refetchInterval: 30_000,
  });
}

// Powers the "My Team" left-side panel on the dashboard -- comes back
// { isManager: false } for anyone who isn't set as a department head, so
// callers just check that flag rather than needing a separate "am I a
// manager" check first.
export function useMyTeamAttendance() {
  return useQuery({
    queryKey: ['dashboard', 'my-team-attendance'],
    queryFn: async () => (await api.get<MyTeamAttendance>('/dashboard/my-team-attendance')).data,
    refetchInterval: 30_000,
  });
}

// Powers the "Real-Time Monitor" panel -- a shorter interval than the other
// dashboard queries since the whole point of that panel is feeling live.
export function useMyTeamRecentPunches() {
  return useQuery({
    queryKey: ['dashboard', 'my-team-recent-punches'],
    queryFn: async () =>
      (await api.get<MyTeamRecentPunches>('/dashboard/my-team-recent-punches')).data,
    refetchInterval: 15_000,
  });
}

// Powers the "Team On Leave" panel -- current/upcoming APPROVED leave for a
// department head's team, so an approval shows up here immediately. Same
// { isManager: false } shape as useMyTeamAttendance for anyone who isn't a
// department head.
export function useMyTeamOnLeave() {
  return useQuery({
    queryKey: ['dashboard', 'my-team-on-leave'],
    queryFn: async () => (await api.get<MyTeamOnLeave>('/dashboard/my-team-on-leave')).data,
    refetchInterval: 30_000,
  });
}

export function useWeeklyAttendance() {
  return useQuery({
    queryKey: ['dashboard', 'weekly'],
    queryFn: async () =>
      (await api.get<{ date: string; present: number; late: number; absent: number }[]>(
        '/dashboard/weekly-attendance',
      )).data,
  });
}

export function useDepartmentAttendanceChart() {
  return useQuery({
    queryKey: ['dashboard', 'department'],
    queryFn: async () =>
      (await api.get<{ department: string; employees: number; present: number }[]>(
        '/dashboard/department-attendance',
      )).data,
  });
}

export function useEmployeeGrowth() {
  return useQuery({
    queryKey: ['dashboard', 'growth'],
    queryFn: async () =>
      (await api.get<{ month: string; count: number }[]>('/dashboard/employee-growth')).data,
  });
}
