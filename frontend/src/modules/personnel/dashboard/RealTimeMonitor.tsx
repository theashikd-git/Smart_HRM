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
 * user heads a department (PersonnelDashboard/ManagerDashboard gate the
 * whole row on that), so no separate "not a manager" state to handle here.
 *
 * Owns its own width (callers render it as a bare flex child, no w-96
 * wrapper around it) so minimizing actually frees up the space next to it
 * for My Calendar to grow into, instead of just hiding its own content
 * while still holding the same-width column -- collapsed is a slim rail
 * (md:w-12) rather than a full-width, empty-bodied card.
 */
export function RealTimeMonitor() {
  const { data, isLoading } = useMyTeamRecentPunches();
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        title="Expand Real-Time Monitor"
        className="flex h-12 w-full shrink-0 items-center justify-center gap-1.5 rounded border border-line bg-white text-success shadow-sm hover:bg-surface-sunken md:h-full md:w-12 md:flex-col md:gap-2"
      >
        <Activity className="h-4 w-4" />
        <Maximize2 className="h-3.5 w-3.5 text-text-muted" />
      </button>
    );
  }

  return (
    <div className="flex h-full w-full shrink-0 flex-col overflow-hidden rounded border border-line bg-white shadow-sm md:w-96">
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2.5">
        <h3 className="flex items-center gap-1.5 text-[15px] font-bold text-success">
          <Activity className="h-4 w-4" />
          Real-Time Monitor
        </h3>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          title="Minimize"
          className="rounded p-1 text-text-muted hover:bg-surface-sunken hover:text-text-primary"
        >
          <Minimize2 className="h-3.5 w-3.5" />
        </button>
      </div>

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
    </div>
  );
}
