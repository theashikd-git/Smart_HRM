'use client';

import { cn } from '@/lib/utils';
import { useDashboardSummary } from '@/hooks/useDashboard';

const BAR_COLOR: Record<string, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

const TEXT_COLOR: Record<string, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

export function AttendanceOverview() {
  const { data: summary, isLoading } = useDashboardSummary();

  const total = summary?.totalEmployees || 0;
  const rows =
    total > 0
      ? [
          { label: 'Present', value: Math.round((summary!.presentToday / total) * 100), color: 'success' },
          { label: 'Late', value: Math.round((summary!.lateToday / total) * 100), color: 'warning' },
          { label: 'Absent', value: Math.round((summary!.absentToday / total) * 100), color: 'danger' },
        ]
      : [];

  return (
    <div className="rounded border border-line bg-white">
      <div className="border-b border-line px-3.5 py-2.5">
        <h3 className="text-[13px] font-semibold text-text-primary">Attendance Overview</h3>
      </div>
      <div className="space-y-3 px-3.5 py-3.5">
        {isLoading && <p className="text-xs text-text-muted">Loading...</p>}
        {!isLoading && rows.length === 0 && <p className="text-xs text-text-muted">No attendance data yet today.</p>}
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-xs text-text-secondary">{row.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken">
              <div className={cn('h-full rounded-full', BAR_COLOR[row.color])} style={{ width: `${row.value}%` }} />
            </div>
            <span className={cn('w-9 shrink-0 text-right text-xs font-semibold', TEXT_COLOR[row.color])}>
              {row.value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
