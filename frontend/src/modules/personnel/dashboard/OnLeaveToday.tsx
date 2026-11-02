'use client';

import { CalendarOff } from 'lucide-react';
import { useLeaveRequests } from '@/hooks/useLeave';
import { formatDate } from '@/lib/utils';

/**
 * Hospital-wide "who's on leave today" -- the dashboard counterpart to
 * LateToday. Unlike Team On Leave (department-head only, see TeamOnLeave),
 * this is plain /leave/requests filtered to status=APPROVED with a date
 * range covering today and no department scoping, so it shows for anyone
 * who sees the full PersonnelDashboard (ADMIN, HR, MANAGING_DIRECTOR) --
 * a Managing Director doesn't need to be a specific department's head to
 * see the whole hospital's leave picture.
 */
export function OnLeaveToday() {
  const today = new Date().toISOString().slice(0, 10);
  const { data, isLoading } = useLeaveRequests({ status: 'APPROVED', startDate: today, endDate: today, pageSize: 50 });
  const rows = data?.items ?? [];

  return (
    <div className="flex h-72 flex-col overflow-hidden rounded border border-line bg-white shadow-sm">
      <div className="shrink-0 border-b border-line px-3.5 py-2.5">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-text-primary">
          <CalendarOff className="h-3.5 w-3.5 text-text-muted" />
          On Leave Today
          {data && data.total > 0 && (
            <span className="ml-auto rounded-full bg-surface-sunken px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary">
              {data.total}
            </span>
          )}
        </h3>
      </div>

      <div className="min-h-0 flex-1 divide-y divide-line/60 overflow-y-auto">
        {isLoading && <p className="px-3.5 py-4 text-xs text-text-muted">Loading...</p>}

        {!isLoading && rows.length === 0 && (
          <p className="px-3.5 py-4 text-xs text-text-muted">No one is on leave today.</p>
        )}

        {rows.map((r) => (
          <div key={r.id} className="px-3.5 py-2.5 text-xs">
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: r.leaveType?.color ?? '#94a3b8' }}
              />
              <p className="truncate font-medium text-text-primary">{r.employee?.fullName ?? '—'}</p>
            </div>
            <p className="mt-0.5 text-[11px] text-text-muted">
              {r.employee?.employeeCode} &middot; {r.employee?.department?.name ?? '—'}
            </p>
            <p className="mt-1 text-[11px] text-text-secondary">
              {r.leaveType?.name} &middot; {formatDate(r.startDate)}
              {r.startDate !== r.endDate && <> — {formatDate(r.endDate)}</>}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
