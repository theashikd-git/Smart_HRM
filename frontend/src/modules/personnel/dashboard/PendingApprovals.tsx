'use client';

import { CalendarClock, ClipboardEdit, Timer, CalendarDays, ChevronRight } from 'lucide-react';
import { useMissingPunches } from '@/hooks/useAttendance';

export function PendingApprovals() {
  const { data: missingPunches, isLoading } = useMissingPunches();

  const rows = [
    {
      id: 'correction',
      label: 'Attendance Corrections',
      icon: ClipboardEdit,
      count: isLoading ? undefined : missingPunches?.length ?? 0,
      available: true,
    },
    { id: 'leave', label: 'Leave Requests', icon: CalendarClock, count: undefined, available: false },
    { id: 'overtime', label: 'Overtime Requests', icon: Timer, count: undefined, available: false },
    { id: 'roster', label: 'Roster Changes', icon: CalendarDays, count: undefined, available: false },
  ];

  return (
    <div className="rounded border border-line bg-white">
      <div className="border-b border-line px-3.5 py-2.5">
        <h3 className="text-[13px] font-semibold text-text-primary">Pending Approvals</h3>
      </div>
      <ul className="divide-y divide-line">
        {rows.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.id} className="flex items-center gap-3 px-3.5 py-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-surface-sunken text-text-secondary">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <span className="flex-1 text-xs text-text-primary">{item.label}</span>
              {item.available ? (
                <span className="text-xs font-semibold text-text-primary">{item.count ?? '—'}</span>
              ) : (
                <span className="text-[11px] text-text-muted">Not built yet</span>
              )}
              <button
                type="button"
                disabled={!item.available}
                className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-surface-sunken hover:text-accent-dark disabled:opacity-30 disabled:hover:bg-transparent"
                aria-label={`View ${item.label}`}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
