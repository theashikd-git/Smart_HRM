'use client';

import { Clock3 } from 'lucide-react';
import { useAttendance } from '@/hooks/useAttendance';
import { formatTime } from '@/lib/utils';

/**
 * Hospital-wide "who's late today" -- unlike My Team Attendance / Real-Time
 * Monitor (both scoped to a department head's own led department, see
 * resolveLedDepartments), this is plain /attendance filtered to today +
 * status=LATE with no department scoping, so it shows on the dashboard for
 * anyone who sees the full PersonnelDashboard (ADMIN, HR, MANAGING_DIRECTOR)
 * regardless of whether they personally head a department -- a Managing
 * Director overseeing the whole hospital, not one department, is exactly
 * who this is for. SummaryCards already shows a bare "Late Today" count;
 * this is the actual list behind that number, with check-in/out times.
 */
export function LateToday() {
  const today = new Date().toISOString().slice(0, 10);
  const { data, isLoading } = useAttendance({ startDate: today, endDate: today, status: 'LATE', pageSize: 50 });
  const rows = data?.items ?? [];

  return (
    <div className="flex h-72 flex-col overflow-hidden rounded border border-line bg-white shadow-sm">
      <div className="shrink-0 border-b border-line px-3.5 py-2.5">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-text-primary">
          <Clock3 className="h-3.5 w-3.5 text-warning" />
          Late Today
          {data && data.total > 0 && (
            <span className="ml-auto rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-semibold text-warning">
              {data.total}
            </span>
          )}
        </h3>
      </div>

      <div className="min-h-0 flex-1 divide-y divide-line/60 overflow-y-auto">
        {isLoading && <p className="px-3.5 py-4 text-xs text-text-muted">Loading...</p>}

        {!isLoading && rows.length === 0 && (
          <p className="px-3.5 py-4 text-xs text-text-muted">No one is late today.</p>
        )}

        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2.5 px-3.5 py-2.5 text-xs">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-text-primary">{r.employee?.fullName ?? '—'}</p>
              <p className="mt-0.5 truncate text-[11px] text-text-muted">
                {r.employee?.employeeCode} &middot; {r.employee?.department?.name ?? '—'}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] text-text-secondary">
                {formatTime(r.checkIn)}
                {r.checkOut && <> — {formatTime(r.checkOut)}</>}
              </p>
              {r.lateMinutes > 0 && (
                <p className="mt-0.5 text-[10px] font-medium text-warning">{r.lateMinutes}m late</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
