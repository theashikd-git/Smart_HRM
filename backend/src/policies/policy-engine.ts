// Rule engine behind the attendance policies (Organization > Policy).
//
// Pure functions only (no database, no clock), so every rule can be unit
// tested. Dates are plain "YYYY-MM-DD" strings and all date maths is done in
// UTC on those strings, so the server's time zone can't shift a day.
//
// Two kinds of arrival can be counted by a policy:
//   GRACE  checked in after shift start but within the shift's grace minutes
//   LATE   checked in after the grace period
// Each counted arrival is an "occurrence". A policy turns occurrences into
// "policy absent" days: every `convertEvery` occurrences beyond `allowed`
// (per counting window) make one absent day. Leftovers that don't fill a
// group carry over until the counter resets.

export type PolicyKind = 'GRACE' | 'LATE';
export type WindowUnit = 'DAYS' | 'WEEKS' | 'MONTHS';

export interface PolicyParams {
  windowUnit: WindowUnit;
  windowSize: number;
  /** Free arrivals per window (GRACE). 0 for LATE. */
  allowed: number;
  /** Every this many arrivals beyond `allowed` = 1 absent day. */
  convertEvery: number;
  /** false = counters never reset (leftovers carry on for good). */
  resetEnabled: boolean;
  /** Reset every this many days from the policy's effective date. null = at the end of each window. */
  resetAfterDays: number | null;
}

// ---------------------------------------------------------------- dates ----

const DAY_MS = 86_400_000;
const parse = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function addDays(key: string, n: number): string {
  return fmt(parse(key) + n * DAY_MS);
}
export function diffDays(from: string, to: string): number {
  return Math.round((parse(to) - parse(from)) / DAY_MS);
}
/** Monday of the week the date falls in. */
export function mondayOf(key: string): string {
  const dow = (new Date(parse(key)).getUTCDay() + 6) % 7;
  return addDays(key, -dow);
}
const monthIndex = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return y * 12 + (m - 1);
};
const monthStart = (idx: number) => `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}-01`;
const monthEnd = (idx: number) => addDays(monthStart(idx + 1), -1);

// -------------------------------------------------------------- windows ----

export interface WindowInfo {
  key: string;
  start: string;
  end: string;
}

/** The counting window a date falls in. Windows are consecutive blocks counted from the policy's effective date. */
export function windowOf(params: Pick<PolicyParams, 'windowUnit' | 'windowSize'>, anchor: string, date: string): WindowInfo {
  const size = Math.max(1, Math.floor(params.windowSize));
  let start: string;
  let end: string;
  if (params.windowUnit === 'DAYS') {
    const idx = Math.floor(diffDays(anchor, date) / size);
    start = addDays(anchor, idx * size);
    end = addDays(start, size - 1);
  } else if (params.windowUnit === 'WEEKS') {
    const base = mondayOf(anchor);
    const idx = Math.floor(Math.floor(diffDays(base, date) / 7) / size);
    start = addDays(base, idx * size * 7);
    end = addDays(start, size * 7 - 1);
  } else {
    const idx = Math.floor((monthIndex(date) - monthIndex(anchor)) / size);
    const first = monthIndex(anchor) + idx * size;
    start = monthStart(first);
    end = monthEnd(first + size - 1);
  }
  return { key: `${params.windowUnit}${size}:${start}`, start, end };
}

/** First day of the counter-reset period a date belongs to. */
export function resetPeriodStart(params: PolicyParams, anchor: string, date: string): string {
  if (!params.resetEnabled) return anchor;
  if (!params.resetAfterDays || params.resetAfterDays < 1) return windowOf(params, anchor, date).start;
  const r = Math.floor(params.resetAfterDays);
  return addDays(anchor, Math.floor(diffDays(anchor, date) / r) * r);
}

// ------------------------------------------------------------- absences ----

export interface OccurrenceInput {
  id: string;
  date: string;
  /** false when the employee was exempt that day: kept for reports, never converted. */
  counted: boolean;
}

export interface AbsenceOutput {
  /** The day the last arrival of the group happened. */
  date: string;
  windowKey: string;
  /** The arrivals that caused this absent day. */
  occurrenceIds: string[];
}

/**
 * Turns an employee's arrivals into policy absent days. Pure and repeatable:
 * the same input always gives the same output, and an arrival listed twice
 * (same date) is counted once, so re-syncing can never double count.
 */
export function computeAbsences(params: PolicyParams, anchor: string, input: OccurrenceInput[]): AbsenceOutput[] {
  const allowed = Math.max(0, Math.floor(params.allowed));
  const every = Math.max(1, Math.floor(params.convertEvery));

  // One arrival per date, counted ones only, oldest first.
  const byDate = new Map<string, OccurrenceInput>();
  for (const o of input) if (o.counted && !byDate.has(o.date)) byDate.set(o.date, o);
  const occs = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const out: AbsenceOutput[] = [];
  let period: string | null = null;
  let windowKey: string | null = null;
  let seenInWindow = 0;
  let pending: OccurrenceInput[] = [];

  for (const o of occs) {
    const p = resetPeriodStart(params, anchor, o.date);
    if (p !== period) {
      period = p;
      pending = []; // counter reset: leftovers are dropped
    }
    const w = windowOf(params, anchor, o.date);
    if (w.key !== windowKey) {
      windowKey = w.key;
      seenInWindow = 0; // "allowed" is per window
    }
    seenInWindow += 1;
    if (seenInWindow <= allowed) continue;
    pending.push(o);
    if (pending.length >= every) {
      const group = pending.splice(0, every);
      out.push({ date: o.date, windowKey: w.key, occurrenceIds: group.map((g) => g.id) });
    }
  }
  return out;
}

// --------------------------------------------------------------- scope -----

export type ScopeTarget = 'DEPARTMENT' | 'DESIGNATION' | 'EMPLOYEE';

export interface PolicyScopeInput {
  kind: 'INCLUDE' | 'EXCLUDE';
  targetType: ScopeTarget;
  targetId: string;
}

export interface PolicyDef {
  id: string;
  type: PolicyKind;
  params: PolicyParams;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: number;
  scopes: PolicyScopeInput[];
}

export interface EmployeeCtx {
  id: string;
  departmentId: string | null;
  designationId: string | null;
  policyExempt: boolean;
  policyExemptUntil: string | null;
}

// More specific beats less specific. (3 is kept free for employee groups.)
const SPECIFICITY: Record<ScopeTarget, number> = { EMPLOYEE: 4, DESIGNATION: 2, DEPARTMENT: 1 };

const matches = (s: PolicyScopeInput, e: EmployeeCtx) =>
  (s.targetType === 'EMPLOYEE' && s.targetId === e.id) ||
  (s.targetType === 'DEPARTMENT' && !!e.departmentId && s.targetId === e.departmentId) ||
  (s.targetType === 'DESIGNATION' && !!e.designationId && s.targetId === e.designationId);

/** How specifically a policy targets this employee: 0 = everyone, up to 4 = the employee. null = does not apply (excluded or not selected). */
export function specificity(policy: PolicyDef, emp: EmployeeCtx): number | null {
  if (policy.scopes.some((s) => s.kind === 'EXCLUDE' && matches(s, emp))) return null;
  const includes = policy.scopes.filter((s) => s.kind === 'INCLUDE');
  if (includes.length === 0) return 0;
  let best: number | null = null;
  for (const s of includes) if (matches(s, emp)) best = Math.max(best ?? 0, SPECIFICITY[s.targetType]);
  return best;
}

export function policyAppliesOn(policy: PolicyDef, date: string): boolean {
  if (date < policy.effectiveFrom) return false;
  if (policy.effectiveTo) return date <= policy.effectiveTo;
  return policy.isActive;
}

/** The one policy of this kind that governs the employee on this date: the most specific match, then the latest effective date. */
export function pickPolicy(policies: PolicyDef[], emp: EmployeeCtx, type: PolicyKind, date: string): PolicyDef | null {
  let best: { p: PolicyDef; spec: number } | null = null;
  for (const p of policies) {
    if (p.type !== type || !policyAppliesOn(p, date)) continue;
    const spec = specificity(p, emp);
    if (spec === null) continue;
    if (
      !best ||
      spec > best.spec ||
      (spec === best.spec && (p.effectiveFrom > best.p.effectiveFrom || (p.effectiveFrom === best.p.effectiveFrom && p.createdAt > best.p.createdAt)))
    ) {
      best = { p, spec };
    }
  }
  return best ? best.p : null;
}

export function isExempt(emp: Pick<EmployeeCtx, 'policyExempt' | 'policyExemptUntil'>, date: string): boolean {
  return emp.policyExempt && (!emp.policyExemptUntil || date <= emp.policyExemptUntil);
}

// ------------------------------------------------------------ daily status -

export type DayKind = 'WORKING' | 'HOLIDAY' | 'WEEKLY_OFF';
export type DayStatus = 'PRESENT' | 'GRACE' | 'LATE' | 'HALF_DAY' | 'HOLIDAY_DUTY' | 'SHORT_HOURS';

export interface ShiftInput {
  shiftType: 'FIXED' | 'FLEXIBLE';
  startMin: number;
  graceMin: number;
  requiredHours: number | null;
}

export interface DayInput {
  employee: EmployeeCtx;
  /** null = the employee has no shift. */
  shift: ShiftInput | null;
  date: string;
  /** Minutes after midnight of the first check-in. */
  checkInMin: number;
  /** Hours worked that day, or null while there is no check-out. */
  workHours: number | null;
  dayKind: DayKind;
  onApprovedLeave: boolean;
  policies: PolicyDef[];
}

export interface DayResult {
  status: DayStatus;
  /** Minutes after shift start (fixed shifts only), as before. */
  lateMinutes: number;
  /** Set when the arrival is tracked by a policy. */
  occurrence: { type: PolicyKind; policyId: string; counted: boolean } | null;
}

/**
 * The daily status for a punched day, in the order the rules apply:
 * holiday / weekly off (duty day, no penalties) > flexible shift (no GRACE or
 * LATE, only SHORT_HOURS) > fixed shift: PRESENT / GRACE / LATE (HALF_DAY when
 * under 4 hours). The arrival is tracked by the most specific matching policy
 * unless the person is on approved leave; an exempt employee's arrival is
 * recorded but not counted.
 */
export function evaluateDay(input: DayInput): DayResult {
  const { shift, workHours } = input;

  if (input.dayKind !== 'WORKING') return { status: 'HOLIDAY_DUTY', lateMinutes: 0, occurrence: null };

  if (!shift) {
    return { status: workHours !== null && workHours < 4 ? 'HALF_DAY' : 'PRESENT', lateMinutes: 0, occurrence: null };
  }

  if (shift.shiftType === 'FLEXIBLE') {
    const required = shift.requiredHours ?? 0;
    const short = workHours !== null && required > 0 && workHours < required;
    return { status: short ? 'SHORT_HOURS' : 'PRESENT', lateMinutes: 0, occurrence: null };
  }

  let arrival: PolicyKind | null = null;
  let lateMinutes = 0;
  if (input.checkInMin > shift.startMin + shift.graceMin) {
    arrival = 'LATE';
    lateMinutes = input.checkInMin - shift.startMin;
  } else if (input.checkInMin > shift.startMin) {
    arrival = 'GRACE';
  }

  let status: DayStatus = arrival === 'LATE' ? 'LATE' : arrival === 'GRACE' ? 'GRACE' : 'PRESENT';
  if (workHours !== null && workHours < 4) status = 'HALF_DAY';

  let occurrence: DayResult['occurrence'] = null;
  if (arrival && !input.onApprovedLeave) {
    const policy = pickPolicy(input.policies, input.employee, arrival, input.date);
    if (policy) {
      occurrence = { type: arrival, policyId: policy.id, counted: !isExempt(input.employee, input.date) };
    }
  }
  return { status, lateMinutes, occurrence };
}
