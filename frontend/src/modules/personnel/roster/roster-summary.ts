import type { RosterAssignment, RosterDayType, Shift } from '@/types';
import type { RosterChange } from '@/hooks/useRoster';

/**
 * Pure helpers behind the Roster "Shift Summary" column and "Coverage" card.
 * No React, no fetching: give them the loaded roster, the unsaved draft and
 * the Shift list, get numbers back. Shift types are never hard-coded; every
 * shift that appears is read from the Shift table (or, for a shift that was
 * since deleted, from the assignment itself).
 */

/** Just what the helpers need to know about a shift. */
export type ShiftInfo = Pick<Shift, 'id' | 'name' | 'startTime' | 'endTime' | 'shiftType' | 'requiredHours'>;

/** What one employee-day looks like once unsaved edits are applied. */
export interface RosterCell {
  type: RosterDayType;
  shiftId: string | null;
  /** Saved but still waiting for HR/Admin (a change, or a requested removal). */
  pending: boolean;
  /** Fallback label when the shift is no longer in the Shift list. */
  shiftName?: string;
  startTime?: string;
  endTime?: string;
}

export type CellResolver = (employeeId: string, dateIso: string) => RosterCell | undefined;

/** One shift's count inside a summary or a coverage list. */
export interface ShiftCount {
  shiftId: string;
  name: string;
  /** "09:00-18:00" or "Flexible, 8h" -- for tooltips. */
  range: string;
  count: number;
  /** How many of `count` are still pending approval. */
  pending: number;
}

export interface EmployeeShiftSummary {
  /** Only shifts the employee actually has in the period. */
  shifts: ShiftCount[];
  /** Days off. Not duty. */
  off: number;
  /** Sum of the shift counts (OFF excluded). */
  duty: number;
  /** Days with nothing assigned. */
  unassigned: number;
  /** Pending-approval days of any kind (shift or off). */
  pending: number;
}

export interface DateCoverage {
  /** Every relevant shift, including those with 0 people. */
  shifts: ShiftCount[];
  off: number;
  unassigned: number;
  /** People counted (the team size). */
  total: number;
}

const keyOf = (employeeId: string, dateIso: string) => `${employeeId}|${dateIso}`;

/**
 * Builds the lookup used by everything else: an unsaved edit wins over the
 * saved row (a staged clear means "empty"); an edit is treated as final, like
 * the grid does, so it never shows as pending.
 */
export function buildCellResolver(assignments: RosterAssignment[], draft: Record<string, RosterChange>): CellResolver {
  const saved = new Map<string, RosterAssignment>();
  for (const a of assignments) saved.set(keyOf(a.employeeId, a.date.slice(0, 10)), a);

  return (employeeId, dateIso) => {
    const key = keyOf(employeeId, dateIso);
    const change = draft[key];
    if (change) {
      if (change.action === 'CLEAR') return undefined;
      return { type: (change.type ?? 'SHIFT') as RosterDayType, shiftId: change.shiftId ?? null, pending: false };
    }
    const a = saved.get(key);
    if (!a) return undefined;
    return {
      type: a.type,
      shiftId: a.shiftId ?? null,
      pending: a.status === 'PENDING' || !!a.pendingRemoval,
      shiftName: a.shift?.name,
      startTime: a.shift?.startTime,
      endTime: a.shift?.endTime,
    };
  };
}

/** "09:00-18:00" for a fixed shift, "Flexible, 8h" for a flexible one. */
export function formatShiftRange(s: Pick<ShiftInfo, 'startTime' | 'endTime' | 'shiftType' | 'requiredHours'>): string {
  if (s.shiftType === 'FLEXIBLE') {
    const h = s.requiredHours != null && s.requiredHours !== '' ? Number(s.requiredHours) : NaN;
    return Number.isFinite(h) ? `Flexible, ${h}h` : 'Flexible';
  }
  return s.startTime && s.endTime ? `${s.startTime}-${s.endTime}` : '';
}

/** Resolves a cell's shift to a display entry (known shift, else what the assignment carried). */
function shiftEntry(cell: RosterCell, byId: Map<string, ShiftInfo>): Omit<ShiftCount, 'count' | 'pending'> {
  const id = cell.shiftId ?? '';
  const known = byId.get(id);
  if (known) return { shiftId: known.id, name: known.name, range: formatShiftRange(known) };
  const range = cell.startTime && cell.endTime ? `${cell.startTime}-${cell.endTime}` : '';
  return { shiftId: id, name: cell.shiftName ?? 'Unknown shift', range };
}

/** Counts one employee's days across `dateIsos`. */
export function summarizeEmployee(
  resolve: CellResolver,
  employeeId: string,
  dateIsos: string[],
  shifts: ShiftInfo[],
): EmployeeShiftSummary {
  const byId = new Map(shifts.map((s) => [s.id, s]));
  const counts = new Map<string, ShiftCount>();
  let off = 0;
  let unassigned = 0;
  let pending = 0;

  for (const dateIso of dateIsos) {
    const cell = resolve(employeeId, dateIso);
    if (!cell) {
      unassigned++;
      continue;
    }
    if (cell.pending) pending++;
    if (cell.type === 'OFF') {
      off++;
      continue;
    }
    const entry = shiftEntry(cell, byId);
    const row = counts.get(entry.shiftId) ?? { ...entry, count: 0, pending: 0 };
    row.count++;
    if (cell.pending) row.pending++;
    counts.set(entry.shiftId, row);
  }

  // Keep the Shift list's order; shifts no longer in the list go last.
  const order = new Map(shifts.map((s, i) => [s.id, i]));
  const rows = Array.from(counts.values()).sort(
    (a, b) => (order.get(a.shiftId) ?? 1e9) - (order.get(b.shiftId) ?? 1e9) || a.name.localeCompare(b.name),
  );
  const duty = rows.reduce((n, r) => n + r.count, 0);
  return { shifts: rows, off, duty, unassigned, pending };
}

/**
 * Head-count for one date. `shifts` is the list to show (shifts with nobody on
 * them are kept, so gaps are visible); a shift not in it that someone is on
 * anyway is added.
 */
export function coverageForDate(
  resolve: CellResolver,
  employeeIds: string[],
  dateIso: string,
  shifts: ShiftInfo[],
): DateCoverage {
  const byId = new Map(shifts.map((s) => [s.id, s]));
  const counts = new Map<string, ShiftCount>(
    shifts.map((s) => [s.id, { shiftId: s.id, name: s.name, range: formatShiftRange(s), count: 0, pending: 0 }]),
  );
  let off = 0;
  let unassigned = 0;

  for (const employeeId of employeeIds) {
    const cell = resolve(employeeId, dateIso);
    if (!cell) {
      unassigned++;
    } else if (cell.type === 'OFF') {
      off++;
    } else {
      const entry = shiftEntry(cell, byId);
      const row = counts.get(entry.shiftId) ?? { ...entry, count: 0, pending: 0 };
      row.count++;
      if (cell.pending) row.pending++;
      counts.set(entry.shiftId, row);
    }
  }
  return { shifts: Array.from(counts.values()), off, unassigned, total: employeeIds.length };
}

/** "15 Nov" from "2026-11-15". */
export function formatDayMonth(dateIso: string): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Multi-line text for the Shift Summary hover tooltip. */
export function summaryTooltip(name: string, s: EmployeeShiftSummary): string {
  const lines = [name];
  for (const r of s.shifts) {
    lines.push(`${r.name}${r.range ? ` (${r.range})` : ''}: ${r.count}${r.pending ? ` (${r.pending} pending)` : ''}`);
  }
  if (s.shifts.length === 0) lines.push('No shifts assigned');
  lines.push(`Days off: ${s.off}`, `Total duty: ${s.duty}`, `Unassigned: ${s.unassigned}`);
  if (s.pending > 0) lines.push(`Pending approval: ${s.pending}`);
  return lines.join('\n');
}
