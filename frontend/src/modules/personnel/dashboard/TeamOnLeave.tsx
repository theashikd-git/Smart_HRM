'use client';

import { useMemo, useState } from 'react';
import { CalendarOff } from 'lucide-react';
import { useMyTeamOnLeave } from '@/hooks/useDashboard';
import { formatDate } from '@/lib/utils';

type Range = 'all' | 'now' | '7d' | '30d' | 'after30' | 'date';

const RANGE_LABEL: Record<Range, string> = {
  all: 'All upcoming',
  now: 'On leave today',
  '7d': 'Next 7 days',
  '30d': 'Next 30 days',
  after30: 'After 1 month',
  date: 'On a specific date',
};

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + n);
  return dayKey(d);
};
/** Calendar days from start to end, both included. */
const spanDays = (start: string, end: string) =>
  Math.round((new Date(`${end}T12:00:00`).getTime() - new Date(`${start}T12:00:00`).getTime()) / 86_400_000) + 1;

/**
 * "Team On Leave" -- for a department head only (see
 * useMyTeamOnLeave/DashboardService.myTeamOnLeave; renders nothing for
 * anyone else). The moment a team member's leave is APPROVED, their name
 * shows up here with the dates -- current leave and anything still
 * upcoming, not just today's -- so the manager always knows who's out and
 * when, without having to go look it up. Sits alongside My Calendar and
 * Real-Time Monitor on the Manager Dashboard (see ManagerDashboard).
 *
 * The list can be narrowed with the filter at the top: today, next 7 / 30
 * days, "After 1 month" (anyone still away a month from now), or a specific
 * date -- plus a "30+ days only" switch for long leaves. All of that is
 * worked out here from the full upcoming list the server already returns.
 */
export function TeamOnLeave() {
  const { data, isLoading } = useMyTeamOnLeave();
  const [range, setRange] = useState<Range>('all');
  const [pickedDate, setPickedDate] = useState('');
  const [longOnly, setLongOnly] = useState(false);

  const today = dayKey(new Date());

  const leaves = useMemo(() => {
    const all = data?.leaves ?? [];
    const key = (v: string) => v.slice(0, 10);
    // Window the leave has to overlap; null = no date limit.
    let from: string | null = null;
    let to: string | null = null;
    if (range === 'now') [from, to] = [today, today];
    else if (range === '7d') [from, to] = [today, addDays(today, 7)];
    else if (range === '30d') [from, to] = [today, addDays(today, 30)];
    else if (range === 'after30') from = addDays(today, 30);
    else if (range === 'date' && pickedDate) [from, to] = [pickedDate, pickedDate];

    return all.filter((l) => {
      const s = key(l.startDate);
      const e = key(l.endDate);
      if (from && e < from) return false;
      if (to && s > to) return false;
      if (longOnly && spanDays(s, e) < 30) return false;
      return true;
    });
  }, [data, range, pickedDate, longOnly, today]);

  if (!isLoading && !data?.isManager) return null;

  const filtered = range !== 'all' || longOnly;

  return (
    <div className="flex h-full w-full shrink-0 flex-col overflow-hidden rounded border border-line bg-white shadow-sm md:w-72">
      <div className="shrink-0 border-b border-line px-3.5 py-2.5">
        <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-text-primary">
          <CalendarOff className="h-3.5 w-3.5 text-text-muted" />
          Team On Leave
          {data && (
            <span className="ml-auto rounded-full bg-surface-sunken px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary">
              {leaves.length}
            </span>
          )}
        </h3>

        <div className="mt-2 flex flex-col gap-1.5">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as Range)}
            className="h-7 w-full rounded border border-line bg-white px-1.5 text-[11px] text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/50"
            aria-label="Leave period"
          >
            {(Object.keys(RANGE_LABEL) as Range[]).map((r) => (
              <option key={r} value={r}>
                {RANGE_LABEL[r]}
              </option>
            ))}
          </select>
          {range === 'date' && (
            <input
              type="date"
              value={pickedDate}
              min={today}
              onChange={(e) => setPickedDate(e.target.value)}
              className="h-7 w-full rounded border border-line bg-white px-1.5 text-[11px] text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/50"
              aria-label="Date"
            />
          )}
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-text-secondary">
            <input
              type="checkbox"
              checked={longOnly}
              onChange={(e) => setLongOnly(e.target.checked)}
              className="h-3 w-3 accent-accent"
            />
            Long leaves only (30+ days)
          </label>
        </div>
      </div>

      <div className="min-h-0 flex-1 divide-y divide-line/60 overflow-y-auto">
        {isLoading && <p className="px-3.5 py-4 text-xs text-text-muted">Loading...</p>}

        {!isLoading && leaves.length === 0 && (
          <p className="px-3.5 py-4 text-xs text-text-muted">
            {filtered ? 'No one on your team matches this filter.' : 'No one on your team is currently on leave.'}
          </p>
        )}

        {leaves.map((l) => (
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
              {l.startDate !== l.endDate && <> to {formatDate(l.endDate)}</>}
              {spanDays(l.startDate.slice(0, 10), l.endDate.slice(0, 10)) > 1 && (
                <> &middot; {spanDays(l.startDate.slice(0, 10), l.endDate.slice(0, 10))} days</>
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
