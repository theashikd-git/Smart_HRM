'use client';

import { DataTable, DataTableColumn } from '@/components/shell/DataTable';
import { StatusBadge } from '@/components/shell/StatusBadge';
import { useAttendance } from '@/hooks/useAttendance';
import { formatTime } from '@/lib/utils';
import type { AttendanceRecord } from '@/types';

const STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Present',
  LATE: 'Late',
  ABSENT: 'Absent',
  HALF_DAY: 'Half Day',
  ON_LEAVE: 'Leave',
  HOLIDAY: 'Off',
};

const columns: DataTableColumn<AttendanceRecord>[] = [
  {
    key: 'employee',
    header: 'Employee',
    render: (r) => (
      <div>
        <p className="font-medium text-text-primary">{r.employee?.fullName ?? '—'}</p>
        <p className="text-[11px] text-text-muted">{r.employee?.employeeCode}</p>
      </div>
    ),
  },
  { key: 'department', header: 'Department', render: (r) => r.employee?.department?.name ?? '—' },
  {
    key: 'shift',
    header: 'Shift',
    render: (r) => (r.employee?.shift ? `${r.employee.shift.name} (${r.employee.shift.startTime}–${r.employee.shift.endTime})` : '—'),
  },
  { key: 'checkIn', header: 'Check In', render: (r) => formatTime(r.checkIn) },
  { key: 'checkOut', header: 'Check Out', render: (r) => formatTime(r.checkOut) },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={STATUS_LABEL[r.status] ?? r.status} /> },
];

/**
 * Shows today's real attendance punches. Named/scoped separately from the
 * future Roster feature (planned shift assignments), which doesn't exist yet.
 */
export function TodaysAttendance() {
  const today = new Date().toISOString().slice(0, 10);
  const { data, isLoading } = useAttendance({ startDate: today, endDate: today, page: 1, pageSize: 8 });

  return (
    <div className="rounded border border-line bg-white">
      <div className="border-b border-line px-3.5 py-2.5">
        <h3 className="text-[13px] font-semibold text-text-primary">Today&apos;s Attendance</h3>
      </div>
      <div className="p-3.5">
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(r) => r.id}
          dense
          emptyLabel={isLoading ? 'Loading...' : 'No attendance recorded yet today'}
        />
      </div>
    </div>
  );
}
