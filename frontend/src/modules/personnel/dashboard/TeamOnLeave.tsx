'use client';

import { CalendarOff } from 'lucide-react';
import { useMyTeamOnLeave } from '@/hooks/useDashboard';
import { formatDate } from '@/lib/utils';

/**
 * "Team On Leave" -- for a department head only (see
 * useMyTeamOnLeave/DashboardService.myTeamOnLeave; renders nothing for
 * anyone else). The moment a team member's leave is APPROVED, their name
 * shows up here with the dates -- current leave and anything still
 * upcoming, not just today's -- so the manager always knows who's out and
 * when, without having to go look it up. Sits alongside My Calendar and
 * Real-Time Monitor on the Manager Dashboard (see ManagerDashboard).
 */
export function TeamOnLeave() {
  const { data, isLoading } = useMyTeamOnLeave();

  if (!isLoading && !data?.isManager) return null;

  return (
    <div className="flex h-full w-full shrink-0 flex-col overflow-hidden rounded border border-line bg-white shadow-sm md:w-72">
      <div className="shrink-0 border-b border-line px-3.5 py-2.5">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-text-primary">
          <CalendarOff className="h-3.5 w-3.5 text-text-muted" />
          Team On Leave
        </h3>
      </div>

      <div className="min-h-0 flex-1 divide-y divide-line/60 overflow-y-auto">
        {isLoading && <p className="px-3.5 py-4 text-xs text-text-muted">Loading...</p>}

        {!isLoading && (data?.leaves.length ?? 0) === 0 && (
          <p className="px-3.5 py-4 text-xs text-text-muted">No one on your team is currently on leave.</p>
        )}

        {data?.leaves.map((l) => (
          <div key={l.id} className="px-3.5 py-2.5 text-xs">
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: l.leaveTypeColor ?? '#94a3b8' }}
              />
              <p className="truncate font-medium text-text-primary">{l.fullName}</p>
            </div>
            <p className="mt-0.5 text-[11px] text-text-muted">{l.employeeCode}</p>
            <p className="mt-1 text-[11px] text-text-secondary">
              {l.leaveTypeName} &middot; {formatDate(l.startDate)}
              {l.startDate !== l.endDate && <> — {formatDate(l.endDate)}</>}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
