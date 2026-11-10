'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldWrap, Input, Select, Textarea } from '@/components/ui/Form';
import { useBulkAssignRoster } from '@/hooks/useRoster';
import { apiErrorMessage } from '@/lib/api';
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

interface Props {
  open: boolean;
  onClose: () => void;
  employees: RosterEmployee[];
  shifts: Shift[];
  /** Pre-ticked employees (e.g. the row the manager clicked from). */
  initialEmployeeIds: string[];
  /** Date range the screen is currently showing -- used as the default. */
  defaultStart: string;
  defaultEnd: string;
  todayIso: string;
  isHrOrAdmin: boolean;
}

/**
 * "Assign Multiple" -- pick people, pick a shift (or day off), pick a date
 * range and which weekdays it applies to, and it fills all of it at once.
 * Replaces clicking 30 cells x N employees one by one for a monthly roster.
 */
export function BulkAssignModal({
  open,
  onClose,
  employees,
  shifts,
  initialEmployeeIds,
  defaultStart,
  defaultEnd,
  todayIso,
  isHrOrAdmin,
}: Props) {
  const bulk = useBulkAssignRoster();

  const [selected, setSelected] = useState<string[]>([]);
  const [type, setType] = useState<RosterDayType>('SHIFT');
  const [shiftId, setShiftId] = useState('');
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [weekdays, setWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [skipExisting, setSkipExisting] = useState(true);
  const [reason, setReason] = useState('');

  // Start fresh every time it's opened.
  useEffect(() => {
    if (!open) return;
    setSelected(initialEmployeeIds);
    setType('SHIFT');
    setShiftId('');
    setStartDate(defaultStart);
    setEndDate(defaultEnd);
    setWeekdays([0, 1, 2, 3, 4, 5, 6]);
    setSkipExisting(true);
    setReason('');
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

  const rangeDays = useMemo(() => daysBetween(startDate, endDate), [startDate, endDate]);
  const matchingDays = useMemo(
    () => rangeDays.filter((d) => weekdays.includes(new Date(`${d}T00:00:00Z`).getUTCDay())),
    [rangeDays, weekdays],
  );
  const hasPast = matchingDays.some((d) => d < todayIso);
  const total = matchingDays.length * selected.length;

  const allTicked = employees.length > 0 && selected.length === employees.length;

  function toggleEmployee(id: string) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }
  function toggleWeekday(v: number) {
    setWeekdays((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  }

  const problem =
    selected.length === 0
      ? 'Tick at least one employee.'
      : type === 'SHIFT' && !shiftId
        ? 'Choose a shift.'
        : rangeDays.length === 0
          ? 'Pick a valid date range.'
          : rangeDays.length > 62
            ? 'Pick a range of at most 62 days.'
            : matchingDays.length === 0
              ? 'None of the ticked weekdays fall inside that range.'
              : total > 2000
                ? 'Too many at once -- pick fewer employees or a shorter range.'
                : hasPast && !reason.trim()
                  ? 'A reason is required because the range includes past dates.'
                  : '';

  async function handleSubmit() {
    if (problem) return;
    try {
      const res = await bulk.mutateAsync({
        employeeIds: selected,
        startDate,
        endDate,
        type,
        shiftId: type === 'SHIFT' ? shiftId : undefined,
        weekdays: weekdays.length === 7 ? undefined : weekdays,
        skipExisting,
        hrNote: hasPast ? reason.trim() : undefined,
      });
      const parts = [`${res.applied} duties set`];
      if (res.skipped) parts.push(`${res.skipped} skipped (already had a duty)`);
      if (res.pending) parts.push(`${res.pending} sent to HR for approval`);
      toast.success(parts.join(' · '));
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assign Multiple"
      subtitle="Fill many days for many people at once"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!!problem} loading={bulk.isPending}>
            {total > 0 && !problem ? `Assign ${total} duties` : 'Assign'}
          </Button>
        </>
      }
    >
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

          <div className="grid grid-cols-2 gap-3">
            <FieldWrap label="From">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </FieldWrap>
            <FieldWrap label="To">
              <Input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
            </FieldWrap>
          </div>

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
                      on ? 'border-accent bg-accent-soft text-accent-dark' : 'border-line text-text-muted hover:bg-surface-sunken',
                    )}
                  >
                    {w.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-text-muted">Untick a day (like the weekly off day) to leave it empty.</p>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-text-secondary">
            <input
              type="checkbox"
              checked={skipExisting}
              onChange={(e) => setSkipExisting(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-accent,#0d9488)]"
            />
            Keep days that already have a duty (only fill the empty ones)
          </label>

          {hasPast && (
            <FieldWrap
              label="Reason (range includes past dates)"
              required
              hint={isHrOrAdmin ? 'Applied right away.' : 'Past dates are sent to HR for approval.'}
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
              `${selected.length} employee${selected.length === 1 ? '' : 's'} × ${matchingDays.length} day${
                matchingDays.length === 1 ? '' : 's'
              } = ${total} duties`}
          </p>
        </div>
      </div>
    </Modal>
  );
}
