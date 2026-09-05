import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DashboardSummary } from '@/types';

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => (await api.get<DashboardSummary>('/dashboard/summary')).data,
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
