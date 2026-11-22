import type { AttendancePolicy, PolicyParams, PolicyType } from '@/types/policy';

/** A date string from the API ("2026-11-22" or a full ISO stamp) as a short readable date. */
export function fmtDay(value?: string | null): string {
  if (!value) return '';
  const d = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const DEFAULT_PARAMS: Record<PolicyType, PolicyParams> = {
  GRACE: { windowUnit: 'DAYS', windowSize: 7, allowed: 3, convertEvery: 3, resetEnabled: true, resetAfterDays: 7 },
  LATE: { windowUnit: 'MONTHS', windowSize: 1, allowed: 0, convertEvery: 3, resetEnabled: true, resetAfterDays: null },
};

const UNIT_LABEL = { DAYS: 'day', WEEKS: 'week', MONTHS: 'month' } as const;

export function windowLabel(p: PolicyParams): string {
  const unit = UNIT_LABEL[p.windowUnit];
  return p.windowSize === 1 ? `${unit}` : `${p.windowSize}-${unit}`;
}

/** The rule as one plain sentence, shown on the list and live in the form. */
export function describeRule(type: PolicyType, p: PolicyParams): string {
  const w = windowLabel(p);
  const arrivals = type === 'GRACE' ? 'grace-period arrival' : 'late arrival';
  const plural = (n: number) => (n === 1 ? arrivals : `${arrivals}s`);
  let rule: string;
  if (type === 'GRACE') {
    rule = `${p.allowed} ${plural(p.allowed)} allowed per ${w} window; every ${p.convertEvery} extra = 1 absent day.`;
  } else {
    rule = `Every ${p.convertEvery} ${plural(p.convertEvery)} = 1 absent day (counted per ${w}).`;
  }
  if (!p.resetEnabled) return `${rule} Counters never reset.`;
  return p.resetAfterDays
    ? `${rule} Counters reset every ${p.resetAfterDays} days.`
    : `${rule} Counters reset at the end of each ${w === 'month' || w === 'week' || w === 'day' ? w : `${w} window`}.`;
}

export type PolicyStatus = 'Active' | 'Scheduled' | 'Ending' | 'Inactive';

export function policyStatus(p: AttendancePolicy, today = todayISO()): PolicyStatus {
  const from = p.effectiveFrom.slice(0, 10);
  const to = p.effectiveTo ? p.effectiveTo.slice(0, 10) : null;
  if (to) return to >= today ? 'Ending' : 'Inactive';
  if (!p.isActive) return 'Inactive';
  return from > today ? 'Scheduled' : 'Active';
}
