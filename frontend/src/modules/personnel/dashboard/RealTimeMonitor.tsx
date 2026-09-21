'use client';

import { useState } from 'react';
import { Activity, Maximize2, Minimize2, Smartphone, User } from 'lucide-react';
import { useMyTeamRecentPunches } from '@/hooks/useDashboard';
import { cn } from '@/lib/utils';

function formatPunchTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

const DIRECTION_LABEL: Record<string, string> = {
  IN: 'Check In',
  OUT: 'Check Out',
  BREAK_IN: 'Break In',
  BREAK_OUT: 'Break Out',
};

const DIRECTION_COLOR: Record<string, string> = {
  IN: 'text-info',
  OUT: 'text-danger',
  BREAK_IN: 'text-info',
  BREAK_OUT: 'text-danger',
};

/**
 * "Real-Time Monitor" -- live feed of raw check-in/check-out punches (not
 * the daily-summary rows the "My Team Today" panel shows) for the
 * signed-in department head's team. Sits to the right of My Calendar on
 * the dashboard; only rendered at all when the caller already knows this
 * user heads a department (PersonnelDashboard gates the whole row on
 * that), so no separate "not a manager" state to handle here.
 *
 * The minimize/expand arrow collapses the punch list down to just the
 * title bar (drops h-full so it stops matching My Calendar's height while
 * collapsed) -- My Calendar next to it is unaffected either way.
 */
export function RealTimeMonitor() {
  const { data, isLoading } = useMyTeamRecentPunches();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded border border-line bg-white shadow-sm',
        !collapsed && 'h-full',
      )}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2.5">
        <h3 className="flex items-center gap-1.5 text-[15px] font-bold text-success">
          <Activity className="h-4 w-4" />
          Real-Time Monitor
        </h3>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? 'Expand' : 'Minimize'}
          className="rounded p-1 text-text-muted hover:bg-surface-sunken hover:text-text-primary"
        >
          {collapsed ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
        </button>
      </div>

      {!collapsed && (
        <div className="min-h-0 flex-1 divide-y divide-line/60 overflow-y-auto">
          {isLoading && <p className="px-4 py-4 text-xs text-text-muted">Loading...</p>}

          {!isLoading && (data?.punches.length ?? 0) === 0 && (
            <p className="px-4 py-4 text-xs text-text-muted">No punches recorded yet today.</p>
          )}

          {data?.punches.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-text-muted">
                <User className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-text-primary">
                  {p.employeeCode} &middot; {p.fullName}
                </p>
                <p className="flex items-center gap-1 text-[11px] text-text-muted">
                  <Smartphone className="h-3 w-3 shrink-0" />
                  <span className="truncate">{p.deviceName ?? 'Manual'}</span>
                  <span className="shrink-0">&middot; {formatPunchTime(p.timestamp)}</span>
                </p>
              </div>
              <span
                className={cn(
                  'shrink-0 text-xs font-medium',
                  p.direction ? DIRECTION_COLOR[p.direction] ?? 'text-text-secondary' : 'text-text-secondary',
                )}
              >
                {p.direction ? DIRECTION_LABEL[p.direction] ?? p.direction : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
