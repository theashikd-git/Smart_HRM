'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Input, Select, Textarea } from '@/components/ui/Form';
import { cn } from '@/lib/utils';
import type { RosterDayType, RosterEmployee, Shift } from '@/types';

// Shown Monday-first, but the value sent is JS getDay() (0 = Sunday).
const WEEKDAYS = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 0 },
];

function daysBetween(a: string, b: string): string[] {
  const out: string[] = [];
  const start = new Date(`${a}T00:00:00Z`);
  const end = new Date(`${b}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return out;
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** "Same duty for everyone" -- one shift / day off across the chosen days. */
export interface BulkPlan {
  employeeIds: string[];
  /** YYYY-MM-DD, already filtered to the ticked weekdays. */
  dates: string[];
  type: RosterDayType;
  shiftId?: string;
  skipExisting: boolean;
  hrNote?: string;
}

/** "Auto roster" -- the random generator (see autoRoster.ts). */
export interface AutoPlan {
  employeeIds: string[];
  /** YYYY-MM-DD, today or later only. */
  dates: string[];
  /** In rotation order; people needed per day on each. */
  shifts: { id: string; count: number }[];
  weeklyOff: boolean;
  keepExisting: boolean;
  fillEveryone: boolean;
}

type Mode = 'auto' | 'same';

interface Props {
  open: boolean;
  onClose: () => void;
  employees: RosterEmployee[];
  shifts: Shift[];
  /** Pre-ticked employees (e.g. the row the manager clicked from). Empty = everyone. */
  initialEmployeeIds: string[];
  /** The date range the screen is showing -- also the range allowed here
   *  (the screen only knows what's already on it, so it can honour
   *  "keep days that already have a duty"). */
  rangeStart: string;
  rangeEnd: string;
  defaultStart: string;
  todayIso: string;
  isHrOrAdmin: boolean;
  /** Both only STAGE the cells on the Roster screen -- nothing is saved
   *  until the manager reviews them and presses Save there. */
  onApply: (plan: BulkPlan) => void;
  onAuto: (plan: AutoPlan) => void;
}

/**
 * "Assign Multiple". Two ways to fill many days for many people:
 *  - Auto roster (default): say how many people each shift needs per day and
 *    it makes the whole roster at random -- one day off per person per week,
 *    shifts rotating weekly -- in one click.
 *  - Same duty for everyone: one shift or day off across the chosen days.
 * Either way the result is only staged on the Roster for review.
 */
export function BulkAssignModal({
  open,
  onClose,
  employees,
  shifts,
  initialEmployeeIds,
  rangeStart,
  rangeEnd,
  defaultStart,
  todayIso,
  isHrOrAdmin,
  onApply,
  onAuto,
}: Props) {
  const [mode, setMode] = useState<Mode>('auto');
  const [selected, setSelected] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(rangeEnd);
  const [skipExisting, setSkipExisting] = useState(true);

  // "Same duty" mode
  const [type, setType] = useState<RosterDayType>('SHIFT');
  const [shiftId, setShiftId] = useState('');
  const [weekdays, setWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [reason, setReason] = useState('');

  // "Auto roster" mode
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [countsTouched, setCountsTouched] = useState(false);
  const [weeklyOff, setWeeklyOff] = useState(true);
  const [fillEveryone, setFillEveryone] = useState(true);

  // Start fresh every time it's opened.
  useEffect(() => {
    if (!open) return;
    setMode('auto');
    setSelected(initialEmployeeIds.length > 0 ? initialEmployeeIds : employees.map((e) => e.id));
    setStartDate(defaultStart);
    setEndDate(rangeEnd);
    setSkipExisting(true);
    setType('SHIFT');
    setShiftId('');
    setWeekdays([0, 1, 2, 3, 4, 5, 6]);
    setReason('');
    setCounts({});
    setCountsTouched(false);
    setWeeklyOff(true);
    setFillEveryone(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selectedEmployees = useMemo(() => employees.filter((e) => selected.includes(e.id)), [employees, selected]);

  // Only shifts that fit every ticked employee: a department's own shift
  // can only go on that department's people (General shifts fit anyone).
  const usableShifts = useMemo(() => {
    const deptIds = new Set(selectedEmployees.map((e) => e.department?.id));
    return shifts.filter((s) => !s.departmentId || [...deptIds].every((d) => d === s.departmentId));
  }, [shifts, selectedEmployees]);

  // Drop the chosen shift if ticking more people made it no longer fit.
  useEffect(() => {
    if (shiftId && !usableShifts.some((s) => s.id === shiftId)) setShiftId('');
  }, [usableShifts, shiftId]);

  // Until the manager types their own numbers, suggest an even split of the
  // people who'll be working each day (everyone except the one on their day off).
  useEffect(() => {
    if (countsTouched || usableShifts.length === 0) return;
    const working = weeklyOff ? selected.length - Math.ceil(selected.length / 7) : selected.length;
    const base = Math.floor(working / usableShifts.length);
    const rem = working % usableShifts.length;
    const next: Record<string, number> = {};
    usableShifts.forEach((s, i) => {
      next[s.id] = Math.max(0, base + (i < rem ? 1 : 0));
    });
    setCounts(next);
  }, [countsTouched, usableShifts, selected.length, weeklyOff]);

  const rangeDays = useMemo(() => daysBetween(startDate, endDate), [startDate, endDate]);
  const outOfView = startDate < rangeStart || endDate > rangeEnd;

  // ---- same duty ----
  const matchingDays = useMemo(
    () => rangeDays.filter((d) => weekdays.includes(new Date(`${d}T00:00:00Z`).getUTCDay())),
    [rangeDays, weekdays],
  );
  const hasPast = matchingDays.some((d) => d < todayIso);
  const total = matchingDays.length * selected.length;

  // ---- auto roster ----
  const autoDays = useMemo(() => rangeDays.filter((d) => d >= todayIso), [rangeDays, todayIso]);
  const autoShifts = usableShifts.map((s) => ({ id: s.id, count: counts[s.id] ?? 0 })).filter((s) => s.count > 0);
  const perDay = autoShifts.reduce((n, s) => n + s.count, 0);
  const worstCaseAvailable = weeklyOff ? selected.length - Math.ceil(selected.length / 7) : selected.length;

  const allTicked = employees.length > 0 && selected.length === employees.length;

  function toggleEmployee(id: string) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }
  function toggleWeekday(v: number) {
    setWeekdays((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  }

  const sharedProblem =
    selected.length === 0
      ? 'Tick at least one employee.'
      : rangeDays.length === 0
        ? 'Pick a valid date range.'
        : outOfView
          ? `Pick dates inside the month/week on screen (${rangeStart} to ${rangeEnd}).`
          : '';

  const sameProblem =
    sharedProblem ||
    (type === 'SHIFT' && !shiftId
      ? 'Choose a shift.'
      : matchingDays.length === 0
        ? 'None of the ticked weekdays fall inside that range.'
        : total > 2000
          ? 'Too many at once -- pick fewer employees or a shorter range.'
          : hasPast && !reason.trim()
            ? 'A reason is required because the range includes past dates.'
            : '');

  const autoProblem =
    sharedProblem ||
    (autoDays.length === 0
      ? 'That period is already in the past -- pick today or later.'
      : usableShifts.length === 0
        ? 'No shift fits the ticked people -- ask HR to add shifts for this department.'
        : perDay === 0
          ? 'Enter how many people each shift needs.'
          : '');

  const problem = mode === 'auto' ? autoProblem : sameProblem;

  function handleSubmit() {
    if (problem) return;
    if (mode === 'auto') {
      onAuto({
        employeeIds: selected,
        dates: autoDays,
        shifts: autoShifts,
        weeklyOff,
        keepExisting: skipExisting,
        fillEveryone,
      });
    } else {
      onApply({
        employeeIds: selected,
        dates: matchingDays,
        type,
        shiftId: type === 'SHIFT' ? shiftId : undefined,
        skipExisting,
        hrNote: hasPast ? reason.trim() : undefined,
      });
    }
    onClose();
  }

  const submitLabel =
    mode === 'auto' ? 'Generate roster' : total > 0 && !sameProblem ? `Add ${total} to roster` : 'Add to roster';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assign Multiple"
      subtitle="Make many days for many people, then review and Save"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!!problem}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <div className="mb-4 inline-flex rounded-md border border-line p-0.5">
        {(
          [
            ['auto', 'Auto roster (random)'],
            ['same', 'Same duty for everyone'],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              'rounded px-3 py-1.5 text-xs font-medium',
              mode === m ? 'bg-accent-soft text-accent-dark' : 'text-text-muted hover:text-text-primary',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Left: who */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Employees ({selected.length}/{employees.length})
            </p>
            <button
              type="button"
              onClick={() => setSelected(allTicked ? [] : employees.map((e) => e.id))}
              className="text-xs font-medium text-accent-dark hover:underline"
            >
              {allTicked ? 'Clear all' : 'Select all'}
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto rounded-md border border-line">
            {employees.map((e) => (
              <label
                key={e.id}
                className="flex cursor-pointer items-center gap-2.5 border-b border-line px-3 py-2 last:border-b-0 hover:bg-surface-sunken"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(e.id)}
                  onChange={() => toggleEmployee(e.id)}
                  className="h-4 w-4 accent-[var(--color-accent,#0d9488)]"
                />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-text-primary">{e.fullName}</span>
                  <span className="block truncate text-[11px] text-text-muted">
                    {e.designation?.title ?? e.employeeCode}
                  </span>
                </span>
              </label>
            ))}
            {employees.length === 0 && <p className="px-3 py-6 text-center text-xs text-text-muted">No employees.</p>}
          </div>
        </div>

        {/* Right: what + when */}
        <div className="space-y-4">
          {mode === 'auto' ? (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
                People needed on each shift, every day
              </p>
              <div className="rounded-md border border-line">
                {usableShifts.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 border-b border-line px-3 py-2 last:border-b-0">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-text-primary">{s.name}</span>
                      <span className="block text-[11px] text-text-muted">
                        {s.startTime}–{s.endTime}
                      </span>
                    </span>
                    <Input
                      type="number"
                      min={0}
                      max={200}
                      value={counts[s.id] ?? 0}
                      onChange={(e) => {
                        setCountsTouched(true);
                        setCounts((c) => ({ ...c, [s.id]: Math.max(0, Math.floor(Number(e.target.value) || 0)) }));
                      }}
                      className="w-20 text-center"
                    />
                  </div>
                ))}
                {usableShifts.length === 0 && (
                  <p className="px-3 py-4 text-xs text-text-muted">No shift fits the ticked people.</p>
                )}
              </div>
              <p className="mt-1 text-[11px] text-text-muted">
                Use 0 to skip a shift. Suggested numbers split the team evenly.
              </p>
            </div>
          ) : (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">Duty</p>
              <div className="mb-2 flex gap-2">
                {(['SHIFT', 'OFF'] as RosterDayType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={cn(
                      'flex-1 rounded-md border px-3 py-1.5 text-sm font-medium',
                      type === t
                        ? 'border-accent bg-accent-soft text-accent-dark'
                        : 'border-line text-text-secondary hover:bg-surface-sunken',
                    )}
                  >
                    {t === 'SHIFT' ? 'Shift' : 'Day Off'}
                  </button>
                ))}
              </div>
              {type === 'SHIFT' && (
                <Select value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
                  <option value="">{usableShifts.length === 0 ? 'No shift fits the ticked people' : 'Select shift'}</option>
                  {usableShifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.startTime}–{s.endTime})
                    </option>
                  ))}
                </Select>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FieldWrap label="From">
              <Input
                type="date"
                value={startDate}
                min={rangeStart}
                max={rangeEnd}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </FieldWrap>
            <FieldWrap label="To">
              <Input type="date" value={endDate} min={startDate} max={rangeEnd} onChange={(e) => setEndDate(e.target.value)} />
            </FieldWrap>
          </div>

          {mode === 'same' && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">On these days</p>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((w) => {
                  const on = weekdays.includes(w.value);
                  return (
                    <button
                      key={w.value}
                      type="button"
                      onClick={() => toggleWeekday(w.value)}
                      className={cn(
                        'w-11 rounded-md border py-1 text-xs font-semibold',
                        on
                          ? 'border-accent bg-accent-soft text-accent-dark'
                          : 'border-line text-text-muted hover:bg-surface-sunken',
                      )}
                    >
                      {w.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-[11px] text-text-muted">Untick a day (like the weekly off day) to leave it empty.</p>
            </div>
          )}

          {mode === 'auto' && (
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-text-secondary">
              <input
                type="checkbox"
                checked={weeklyOff}
                onChange={(e) => setWeeklyOff(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-accent,#0d9488)]"
              />
              Give everyone 1 random day off every week
            </label>
          )}

          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-text-secondary">
            <input
              type="checkbox"
              checked={skipExisting}
              onChange={(e) => setSkipExisting(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-accent,#0d9488)]"
            />
            Keep days that already have a duty (only fill the empty ones)
          </label>

          {mode === 'auto' && (
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-text-secondary">
              <input
                type="checkbox"
                checked={fillEveryone}
                onChange={(e) => setFillEveryone(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-accent,#0d9488)]"
              />
              Put extra people on a shift too (so nobody is left without duty)
            </label>
          )}

          {mode === 'same' && hasPast && (
            <FieldWrap
              label="Reason (range includes past dates)"
              required
              hint={isHrOrAdmin ? 'Applied right away when you Save.' : 'Past dates are sent to HR for approval when you Save.'}
            >
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Why are past dates being changed?"
              />
            </FieldWrap>
          )}

          <p className={cn('text-xs', problem ? 'text-danger' : 'text-text-muted')}>
            {problem ||
              (mode === 'auto'
                ? `${selected.length} people × ${autoDays.length} day${autoDays.length === 1 ? '' : 's'}, ${perDay} needed per day. Past days are skipped; unsaved edits for these people in this range are replaced.`
                : `${selected.length} employee${selected.length === 1 ? '' : 's'} × ${matchingDays.length} day${
                    matchingDays.length === 1 ? '' : 's'
                  } = ${total} duties`)}
          </p>
          {mode === 'auto' && !problem && perDay > worstCaseAvailable && (
            <p className="text-xs text-warning">
              You asked for {perDay} people a day but only about {worstCaseAvailable} will be working
              {weeklyOff ? ' (everyone gets a day off)' : ''} -- some shifts will come out short.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
