'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMyRoster } from '@/hooks/useRoster';
import { useMyLeaveRequests } from '@/hooks/useLeave';
import { useShifts } from '@/hooks/useShifts';
import { cn, leaveStatusColors } from '@/lib/utils';
import type { RosterAssignment, LeaveRequest } from '@/types';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat'];

// Shifts are user-defined (no fixed "Morning = X" in the schema), so each
// shift gets a stable color by its position in the sorted shift-id list.
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
 * "My Calendar" on the Employee Portal home. Styled to match a specific
 * reference screenshot the user provided pixel-for-pixel (light gray title
 * bar, olive-green heading, centered month title with a Today/prev/next
 * control group, plain grid with muted out-of-month days and a cream
 * highlight on today) rather than the app's usual teal Smart HRM theme --
 * this card is a deliberate one-off exception to that theme, per an
 * explicit request to replicate the reference image exactly.
 *
 * Still shows real data inside that chrome: each day's assigned duty
 * (from Roster) and leave status (from the employee's own leave requests).
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
    <div className="mb-4 rounded border border-[#e3e3e3] bg-white shadow-sm overflow-hidden">
      {/* Title bar -- light gray strip, olive-green heading, matches the reference exactly */}
      <div className="border-b border-[#e3e3e3] bg-[#f5f5f6] px-4 py-2.5">
        <h3 className="text-[15px] font-bold text-[#8ba33f]">My Calendar</h3>
      </div>

      {/* Month title + Today/prev/next controls */}
      <div className="relative flex items-center justify-center px-4 py-3.5">
        <span className="text-[26px] leading-none text-[#2d2d2d]">{monthLabel}</span>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          <button
            onClick={() => setMonthDate(startOfMonth(new Date()))}
            className="rounded border border-[#d0d0d0] bg-[#f0f0f0] px-3 py-1 text-xs text-[#555] hover:bg-[#e6e6e6]"
          >
            Today
          </button>
          <div className="flex items-stretch overflow-hidden rounded border border-[#d0d0d0]">
            <button
              onClick={() => setMonthDate((d) => addMonths(d, -1))}
              className="px-2 py-1 text-[#555] hover:bg-[#e6e6e6]"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="w-px bg-[#d0d0d0]" />
            <button
              onClick={() => setMonthDate((d) => addMonths(d, 1))}
              className="px-2 py-1 text-[#555] hover:bg-[#e6e6e6]"
              aria-label="Next month"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Weekday header row */}
      <div className="grid grid-cols-7 border-t border-[#e3e3e3]">
        {WEEKDAY_LABELS.map((w) => (
          <div
            key={w}
            className="border-b border-r border-[#e3e3e3] py-2 text-center text-[13px] font-bold text-[#2d2d2d] last:border-r-0"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {gridDays.map((day, i) => {
          const dateIso = isoDate(day);
          const inMonth = day.getMonth() === monthDate.getMonth();
          const isToday = dateIso === todayIso;
          const assignment = assignmentByDate.get(dateIso);
          const leave = leaveByDate.get(dateIso);
          const shiftC = assignment && assignment.type === 'SHIFT' ? shiftColors(assignment.shiftId ?? '') : null;
          const isLastCol = i % 7 === 6;

          return (
            <div
              key={i}
              className={cn(
                'min-h-[68px] border-b border-r border-[#e3e3e3] p-1.5',
                isLastCol && 'border-r-0',
                isToday && 'bg-[#fdf3d7]',
              )}
            >
              <div className={cn('text-[13px]', inMonth ? 'text-[#2d2d2d]' : 'text-[#b5b5b5]')}>{day.getDate()}</div>

              <div className="mt-1 flex flex-col gap-0.5">
                {leave && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded px-1 py-0.5 text-[9.5px] font-medium leading-tight truncate',
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
                      'inline-flex items-center gap-1 rounded px-1 py-0.5 text-[9.5px] font-medium leading-tight truncate',
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
                  <span className="inline-flex items-center gap-1 rounded bg-[#f0f0f0] px-1 py-0.5 text-[9.5px] font-medium leading-tight text-[#8a8a8a]">
                    <span className="h-1 w-1 shrink-0 rounded-full bg-[#8a8a8a]" />
                    Day Off
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 border-t border-[#e3e3e3] px-4 py-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[#8a8a8a]">Legend</span>
        {(shifts ?? []).map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1 text-[11px] text-[#555]">
            <span className={cn('h-1.5 w-1.5 rounded-full', shiftColors(s.id).dot)} />
            {s.name}
          </span>
        ))}
        <span className="inline-flex items-center gap-1 text-[11px] text-[#555]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#8a8a8a]" />
          Day Off
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] text-[#555]">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Leave Approved
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] text-[#555]">
          <span className="h-1.5 w-1.5 rounded-full bg-warning" />
          Leave Pending
        </span>
      </div>
    </div>
  );
}
