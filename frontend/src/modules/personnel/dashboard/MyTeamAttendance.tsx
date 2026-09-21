'use client';

import { Users } from 'lucide-react';
import { StatusBadge } from '@/components/shell/StatusBadge';
import { useMyTeamAttendance } from '@/hooks/useDashboard';
import { formatTime } from '@/lib/utils';

const STATUS_LABEL: Record<string, string> = {
  PRESENT: 'Present',
  LATE: 'Late',
  ABSENT: 'Absent',
  HALF_DAY: 'Half Day',
  ON_LEAVE: 'Leave',
  HOLIDAY: 'Off',
};

/**
 * Left-side "My Team" panel -- only for a department head (see
 * useMyTeamAttendance/DashboardService.myTeamAttendance for how that's
 * decided). Renders nothing for anyone else, so it never reserves layout
 * space it isn't using. Deliberately its own small list rather than the
 * full Today's Attendance table -- just the people this person is head of,
 * with today's check in/out at a glance.
 */
export function MyTeamAttendance() {
  const { data, isLoading } = useMyTeamAttendance();

  if (!isLoading && !data?.isManager) return null;

  return (
    <div className="rounded border border-line bg-white">
      <div className="border-b border-line px-3.5 py-2.5">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-text-primary">
          <Users className="h-3.5 w-3.5 text-text-muted" />
          My Team Today
        </h3>
        {data?.departments && data.departments.length > 0 && (
          <p className="mt-0.5 text-[11px] text-text-muted">{data.departments.join(', ')}</p>
        )}
      </div>

      <div className="divide-y divide-line/60">
        {isLoading && <p className="px-3.5 py-4 text-xs text-text-muted">Loading...</p>}

        {!isLoading && (data?.members.length ?? 0) === 0 && (
          <p className="px-3.5 py-4 text-xs text-text-muted">No one is currently assigned to your department.</p>
        )}

        {data?.members.map((m) => (
          <div key={m.id} className="px-3.5 py-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-text-primary">{m.fullName}</p>
                <p className="text-[11px] text-text-muted">{m.employeeCode}</p>
              </div>
              <StatusBadge status={STATUS_LABEL[m.status] ?? m.status} />
            </div>
            <div className="mt-1 flex items-center gap-3 text-[11px] text-text-secondary">
              <span>In: {formatTime(m.checkIn)}</span>
              <span>Out: {formatTime(m.checkOut)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
