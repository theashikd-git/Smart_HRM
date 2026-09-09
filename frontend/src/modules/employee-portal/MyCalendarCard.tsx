'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useMyRoster } from '@/hooks/useRoster';
import { useMyLeaveRequests } from '@/hooks/useLeave';
import { useShifts } from '@/hooks/useShifts';
import { cn, leaveStatusColors } from '@/lib/utils';
import type { RosterAssignment, LeaveRequest } from '@/types';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Same idea as the Roster program's palette -- shifts are user-defined, so
// there's no fixed "Morning = teal" mapping in the schema; each shift gets a
// stable color by its position in the sorted shift-id list instead.
const SHIFT_PALETTE = [
  { bg: 'bg-accent-soft', text: 'text-accent-dark', dot: 'bg-accent' },
  { bg: 'bg-info-soft', text: 'text-info', dot: 'bg-info' },
  { bg: 'bg-warning-soft', text: 'text-warning', dot: 'bg-warning' },
  { bg: 'bg-success-soft', text: 'text-success', dot: 'bg-success' },
];

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addDays(d: Date, n: number): Date {
  const nd = new Date(d);
  nd.setDate(d.getDate() + n);
  return nd;
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * "My Calendar" on the Employee Portal home: a month grid showing this
 * employee's own planned duty (assigned by their manager/supervisor on the
 * Roster screen) and their leave status, day by day. Read-only -- assigning
 * duty happens on Roster, applying for leave happens via "Apply for Leave"
 * above; this is just where an employee sees both together.
 */
export function MyCalendarCard() {
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()));

  const gridStart = useMemo(() => {
    const first = startOfMonth(monthDate);
    return addDays(first, -first.getDay());
  }, [monthDate]);
  const gridDays = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart]);

  const { data: rosterData } = useMyRoster({ startDate: isoDate(gridDays[0]), endDate: isoDate(gridDays[41]) });
  const { data: leaveRequests } = useMyLeaveRequests();
  const { data: shifts } = useShifts();

  const sortedShiftIds = useMemo(() => (shifts ?? []).map((s) => s.id).sort(), [shifts]);
  function shiftColors(shiftId: string) {
    const idx = sortedShiftIds.indexOf(shiftId);
    return SHIFT_PALETTE[idx >= 0 ? idx % SHIFT_PALETTE.length : 0];
  }

  const assignmentByDate = useMemo(() => {
    const map = new Map<string, RosterAssignment>();
    for (const a of rosterData?.assignments ?? []) map.set(a.date.slice(0, 10), a);
    return map;
  }, [rosterData]);

  const leaveByDate = useMemo(() => {
    const map = new Map<string, LeaveRequest>();
    const active = (leaveRequests ?? []).filter((r) => r.status === 'PENDING' || r.status === 'APPROVED');
    for (const req of active) {
      let d = new Date(req.startDate);
      const end = new Date(req.endDate);
      while (d <= end) {
        map.set(isoDate(d), req);
        d = addDays(d, 1);
      }
    }
    return map;
  }, [leaveRequests]);

  const todayIso = isoDate(new Date());
  const monthLabel = monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <Card className="mb-4">
      <CardHeader
        title="My Calendar"
        subtitle="Your assigned duty and leave status"
        action={
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setMonthDate((d) => addMonths(d, -1))}
              className="rounded-md p-1.5 text-text-muted hover:bg-surface-sunken hover:text-text-primary"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[112px] text-center text-xs font-semibold text-text-primary">{monthLabel}</span>
            <button
              onClick={() => setMonthDate((d) => addMonths(d, 1))}
              className="rounded-md p-1.5 text-text-muted hover:bg-surface-sunken hover:text-text-primary"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <Button variant="outline" size="sm" onClick={() => setMonthDate(startOfMonth(new Date()))}>
              Today
            </Button>
          </div>
        }
      />

      <div className="px-5 pb-5">
        <div className="grid grid-cols-7 border-t border-l border-line">
          {WEEKDAY_LABELS.map((w) => (
            <div
              key={w}
              className="border-b border-r border-line bg-surface-sunken/60 px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-text-muted"
            >
              {w}
            </div>
          ))}
          {gridDays.map((day, i) => {
            const dateIso = isoDate(day);
            const inMonth = day.getMonth() === monthDate.getMonth();
            const isToday = dateIso === todayIso;
            const assignment = assignmentByDate.get(dateIso);
            const leave = leaveByDate.get(dateIso);
            const shiftC = assignment && assignment.type === 'SHIFT' ? shiftColors(assignment.shiftId ?? '') : null;

            return (
              <div
                key={i}
                className={cn(
                  'border-b border-r border-line min-h-[76px] p-1.5',
                  !inMonth && 'bg-surface-sunken/30',
                  isToday && 'bg-accent-soft/40',
                )}
              >
                <div
                  className={cn(
                    'text-[11px] font-medium',
                    !inMonth ? 'text-text-muted' : isToday ? 'text-accent-dark font-semibold' : 'text-text-secondary',
                  )}
                >
                  {day.getDate()}
                </div>

                <div className="mt-1 flex flex-col gap-1">
                  {leave && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] font-medium leading-tight truncate',
                        leaveStatusColors[leave.status].bg,
                        leaveStatusColors[leave.status].text,
                      )}
                      title={`${leave.leaveType?.name ?? 'Leave'} — ${leave.status === 'APPROVED' ? 'Approved' : 'Pending approval'}`}
                    >
                      <span className={cn('h-1 w-1 shrink-0 rounded-full', leaveStatusColors[leave.status].dot)} />
                      {leave.status === 'APPROVED' ? 'On Leave' : 'Leave (pending)'}
                    </span>
                  )}

                  {assignment && assignment.type === 'SHIFT' && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] font-medium leading-tight truncate',
                        shiftC!.bg,
                        shiftC!.text,
                      )}
                      title={assignment.shift ? `${assignment.shift.startTime}–${assignment.shift.endTime}` : undefined}
                    >
                      <span className={cn('h-1 w-1 shrink-0 rounded-full', shiftC!.dot)} />
                      {assignment.shift?.name ?? 'Shift'}
                    </span>
                  )}

                  {assignment && assignment.type === 'OFF' && (
                    <span className="inline-flex items-center gap-1 rounded bg-surface-sunken px-1.5 py-0.5 text-[9.5px] font-medium leading-tight text-text-muted">
                      <span className="h-1 w-1 shrink-0 rounded-full bg-text-muted" />
                      Day Off
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Legend</span>
          {(shifts ?? []).map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1 text-[11px] text-text-secondary">
              <span className={cn('h-1.5 w-1.5 rounded-full', shiftColors(s.id).dot)} />
              {s.name}
            </span>
          ))}
          <span className="inline-flex items-center gap-1 text-[11px] text-text-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-text-muted" />
            Day Off
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-text-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Leave Approved
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-text-secondary">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" />
            Leave Pending
          </span>
        </div>
      </div>
    </Card>
  );
}
