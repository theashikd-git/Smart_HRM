import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type AttendanceDetailType = 'late' | 'absent' | 'overtime' | 'present' | 'early-out' | 'missing-punch';

export interface AttendanceDetailQuery {
  type: AttendanceDetailType;
  startDate: string;
  endDate: string;
  departmentId?: string;
  employeeId?: string;
  shiftId?: string;
}

/** One row of any attendance report (see ReportsService.attendanceDetail). */
export interface AttendanceDetailRow {
  id: string;
  date: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string | null;
  shift: string | null;
  scheduledIn: string | null;
  scheduledOut: string | null;
  checkIn: string | null;
  checkOut: string | null;
  workHours: number | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  status: string;
  note: string | null;
  /** true for an absent day an attendance policy created (every N late / grace arrivals). */
  policyAbsence?: boolean;
}

export function useAttendanceDetail(query: AttendanceDetailQuery, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['reports', 'attendance-detail', query],
    queryFn: async () =>
      (await api.get<{ type: string; total: number; rows: AttendanceDetailRow[] }>('/reports/attendance-detail', {
        params: query,
      })).data,
    enabled: options?.enabled ?? true,
  });
}

/** Month of raw attendance rows -- the Monthly Attendance tab summarises these. */
export interface MonthlyRecord {
  id: string;
  employeeId: string;
  date: string;
  status: string;
  lateMinutes: number;
  overtimeMinutes: number;
  workHours?: number | string | null;
  employee: { fullName: string; employeeCode: string; department?: { name: string } | null };
}

export function useMonthlyRecords(month: string) {
  return useQuery({
    queryKey: ['reports', 'monthly', month],
    queryFn: async () => (await api.get<MonthlyRecord[]>('/reports/monthly-attendance', { params: { month } })).data,
  });
}
