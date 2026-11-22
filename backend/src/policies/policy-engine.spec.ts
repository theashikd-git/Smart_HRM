import {
  computeAbsences,
  evaluateDay,
  pickPolicy,
  windowOf,
  resetPeriodStart,
  isExempt,
  PolicyDef,
  PolicyParams,
  EmployeeCtx,
  ShiftInput,
  DayInput,
} from './policy-engine';

const graceParams: PolicyParams = { windowUnit: 'DAYS', windowSize: 7, allowed: 3, convertEvery: 3, resetEnabled: true, resetAfterDays: 7 };
const lateParams: PolicyParams = { windowUnit: 'MONTHS', windowSize: 1, allowed: 0, convertEvery: 3, resetEnabled: true, resetAfterDays: null };

// 2026-11-02 is a Monday.
const occ = (dates: string[], counted = true) => dates.map((d) => ({ id: `o-${d}`, date: d, counted }));

describe('windows', () => {
  it('N-day blocks count from the effective date', () => {
    expect(windowOf(graceParams, '2026-11-04', '2026-11-04').start).toBe('2026-11-04');
    expect(windowOf(graceParams, '2026-11-04', '2026-11-10').end).toBe('2026-11-10');
    expect(windowOf(graceParams, '2026-11-04', '2026-11-11').start).toBe('2026-11-11');
  });
  it('week windows run Monday to Sunday', () => {
    const p = { windowUnit: 'WEEKS' as const, windowSize: 1 };
    const w = windowOf(p, '2026-11-04', '2026-11-08'); // Sunday
    expect(w.start).toBe('2026-11-02');
    expect(w.end).toBe('2026-11-08');
    expect(windowOf(p, '2026-11-04', '2026-11-09').start).toBe('2026-11-09');
  });
  it('month windows are calendar months', () => {
    const p = { windowUnit: 'MONTHS' as const, windowSize: 1 };
    expect(windowOf(p, '2026-01-15', '2026-02-28')).toMatchObject({ start: '2026-02-01', end: '2026-02-28' });
    expect(windowOf(p, '2026-01-15', '2026-03-01').start).toBe('2026-03-01');
  });
  it('reset period: default is the window, otherwise every N days', () => {
    expect(resetPeriodStart(lateParams, '2026-01-01', '2026-03-17')).toBe('2026-03-01');
    expect(resetPeriodStart(graceParams, '2026-11-02', '2026-11-20')).toBe('2026-11-16');
    expect(resetPeriodStart({ ...graceParams, resetEnabled: false }, '2026-11-02', '2027-05-01')).toBe('2026-11-02');
  });
});

describe('GRACE policy (window 7 days, 3 allowed, every 3 extra = 1 absent)', () => {
  const anchor = '2026-11-02';
  it('3 grace arrivals in a week: no absent day', () => {
    expect(computeAbsences(graceParams, anchor, occ(['2026-11-02', '2026-11-03', '2026-11-04']))).toEqual([]);
  });
  it('the 4th, 5th and 6th make 1 absent only on the 6th', () => {
    const dates = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'];
    const out = computeAbsences(graceParams, anchor, occ(dates));
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe('2026-11-07');
    expect(out[0].occurrenceIds).toEqual(['o-2026-11-05', 'o-2026-11-06', 'o-2026-11-07']);
  });
  it('only 2 extras (4th and 5th) are not enough', () => {
    const dates = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'];
    expect(computeAbsences(graceParams, anchor, occ(dates))).toEqual([]);
  });
  it('allowance is per window: next week starts fresh', () => {
    const dates = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'];
    // extras: 11-05 (week 1) and 11-12 (week 2) -> reset after 7 days drops the leftover
    expect(computeAbsences(graceParams, anchor, occ(dates))).toEqual([]);
  });
});

describe('LATE policy (every 3 late days = 1 absent, per calendar month)', () => {
  const anchor = '2026-01-01';
  it('3 late days = 1 absent, dated on the 3rd', () => {
    const out = computeAbsences(lateParams, anchor, occ(['2026-03-02', '2026-03-09', '2026-03-16']));
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe('2026-03-16');
  });
  it('7 late days = 2 absent, 1 left over', () => {
    const dates = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-09', '2026-03-10'];
    expect(computeAbsences(lateParams, anchor, occ(dates))).toHaveLength(2);
  });
  it('leftovers reset at the month boundary', () => {
    const out = computeAbsences(lateParams, anchor, occ(['2026-03-30', '2026-03-31', '2026-04-01']));
    expect(out).toEqual([]);
  });
  it('leftovers carry over inside the reset period (reset every 30 days, window 1 week)', () => {
    const p: PolicyParams = { windowUnit: 'WEEKS', windowSize: 1, allowed: 0, convertEvery: 3, resetEnabled: true, resetAfterDays: 30 };
    const out = computeAbsences(p, '2026-11-02', occ(['2026-11-03', '2026-11-10', '2026-11-17']));
    expect(out).toHaveLength(1);
  });
  it('reset off: leftovers carry forever', () => {
    const p: PolicyParams = { ...lateParams, resetEnabled: false };
    const out = computeAbsences(p, anchor, occ(['2026-03-30', '2026-04-15', '2026-06-01']));
    expect(out).toHaveLength(1);
    expect(out[0].date).toBe('2026-06-01');
  });
  it('uncounted (exempt) arrivals never convert', () => {
    expect(computeAbsences(lateParams, anchor, occ(['2026-03-02', '2026-03-09', '2026-03-16'], false))).toEqual([]);
  });
});

describe('idempotency', () => {
  it('same input twice gives identical output; duplicate rows are counted once', () => {
    const base = occ(['2026-03-02', '2026-03-09', '2026-03-16']);
    const a = computeAbsences(lateParams, '2026-01-01', base);
    const b = computeAbsences(lateParams, '2026-01-01', [...base, ...base]);
    expect(b).toEqual(a);
    expect(computeAbsences(lateParams, '2026-01-01', [...base].reverse())).toEqual(a);
  });
});

// ---- daily evaluation ----

const emp: EmployeeCtx = { id: 'e1', departmentId: 'd1', designationId: 'g1', policyExempt: false, policyExemptUntil: null };
const fixed: ShiftInput = { shiftType: 'FIXED', startMin: 540, graceMin: 15, requiredHours: null }; // 09:00, grace 15
const flexible: ShiftInput = { shiftType: 'FLEXIBLE', startMin: 0, graceMin: 0, requiredHours: 8 };

const policy = (over: Partial<PolicyDef> & { id: string }): PolicyDef => ({
  type: 'LATE',
  params: lateParams,
  isActive: true,
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  createdAt: 1,
  scopes: [],
  ...over,
});
const gracePolicy = policy({ id: 'g', type: 'GRACE', params: graceParams });
const latePolicy = policy({ id: 'l', type: 'LATE', params: lateParams });

const day = (over: Partial<DayInput>): DayInput => ({
  employee: emp,
  shift: fixed,
  date: '2026-11-10',
  checkInMin: 540,
  workHours: 8,
  dayKind: 'WORKING',
  onApprovedLeave: false,
  policies: [gracePolicy, latePolicy],
  ...over,
});

describe('evaluateDay', () => {
  it('on time = PRESENT, no occurrence', () => {
    expect(evaluateDay(day({ checkInMin: 535 }))).toEqual({ status: 'PRESENT', lateMinutes: 0, occurrence: null });
    expect(evaluateDay(day({ checkInMin: 540 })).status).toBe('PRESENT');
  });
  it('after start but within grace = GRACE', () => {
    const r = evaluateDay(day({ checkInMin: 550 }));
    expect(r.status).toBe('GRACE');
    expect(r.occurrence).toEqual({ type: 'GRACE', policyId: 'g', counted: true });
  });
  it('last grace minute is still GRACE, the next one is LATE', () => {
    expect(evaluateDay(day({ checkInMin: 555 })).status).toBe('GRACE');
    const r = evaluateDay(day({ checkInMin: 556 }));
    expect(r.status).toBe('LATE');
    expect(r.lateMinutes).toBe(16);
    expect(r.occurrence?.type).toBe('LATE');
  });
  it('under 4 hours = HALF_DAY, arrival still tracked', () => {
    const r = evaluateDay(day({ checkInMin: 600, workHours: 3 }));
    expect(r.status).toBe('HALF_DAY');
    expect(r.occurrence?.type).toBe('LATE');
  });
  it('no policy configured: status is set, nothing tracked', () => {
    const r = evaluateDay(day({ checkInMin: 550, policies: [] }));
    expect(r.status).toBe('GRACE');
    expect(r.occurrence).toBeNull();
  });
  it('approved leave day: no occurrence', () => {
    expect(evaluateDay(day({ checkInMin: 600, onApprovedLeave: true })).occurrence).toBeNull();
  });
  it('holiday or weekly off punch = HOLIDAY_DUTY, never late', () => {
    for (const dayKind of ['HOLIDAY', 'WEEKLY_OFF'] as const) {
      expect(evaluateDay(day({ dayKind, checkInMin: 700 }))).toEqual({ status: 'HOLIDAY_DUTY', lateMinutes: 0, occurrence: null });
    }
  });
  it('flexible shift: no GRACE/LATE; fewer hours = SHORT_HOURS', () => {
    expect(evaluateDay(day({ shift: flexible, checkInMin: 700, workHours: 8 }))).toEqual({ status: 'PRESENT', lateMinutes: 0, occurrence: null });
    expect(evaluateDay(day({ shift: flexible, checkInMin: 700, workHours: 6.5 })).status).toBe('SHORT_HOURS');
    expect(evaluateDay(day({ shift: flexible, workHours: 6.5 })).occurrence).toBeNull();
  });
  it('no check-out yet on a flexible shift is not short', () => {
    expect(evaluateDay(day({ shift: flexible, workHours: null })).status).toBe('PRESENT');
  });
});

describe('exemption', () => {
  it('exempt employee still shows LATE/GRACE but the arrival is not counted', () => {
    const exempt = { ...emp, policyExempt: true };
    const r = evaluateDay(day({ employee: exempt, checkInMin: 600 }));
    expect(r.status).toBe('LATE');
    expect(r.occurrence).toEqual({ type: 'LATE', policyId: 'l', counted: false });
  });
  it('exempt-until: counts again after the date', () => {
    const e = { policyExempt: true, policyExemptUntil: '2026-11-15' };
    expect(isExempt(e, '2026-11-15')).toBe(true);
    expect(isExempt(e, '2026-11-16')).toBe(false);
    expect(isExempt({ policyExempt: false, policyExemptUntil: null }, '2026-11-10')).toBe(false);
  });
});

describe('scope and precedence', () => {
  const all = policy({ id: 'all' });
  const dept = policy({ id: 'dept', scopes: [{ kind: 'INCLUDE', targetType: 'DEPARTMENT', targetId: 'd1' }] });
  const desig = policy({ id: 'desig', scopes: [{ kind: 'INCLUDE', targetType: 'DESIGNATION', targetId: 'g1' }] });
  const person = policy({ id: 'person', scopes: [{ kind: 'INCLUDE', targetType: 'EMPLOYEE', targetId: 'e1' }] });
  const pick = (ps: PolicyDef[], e = emp, date = '2026-11-10') => pickPolicy(ps, e, 'LATE', date)?.id ?? null;

  it('employee > designation > department > all', () => {
    expect(pick([all, dept, desig, person])).toBe('person');
    expect(pick([all, dept, desig])).toBe('desig');
    expect(pick([all, dept])).toBe('dept');
    expect(pick([all])).toBe('all');
  });
  it('a policy for another department does not apply', () => {
    expect(pick([dept], { ...emp, departmentId: 'd2' })).toBeNull();
  });
  it('exclusion list removes the employee, falling back to the next policy', () => {
    const allButHim = policy({ id: 'all', scopes: [{ kind: 'EXCLUDE', targetType: 'EMPLOYEE', targetId: 'e1' }] });
    expect(pick([allButHim])).toBeNull();
    expect(pick([allButHim, dept])).toBe('dept');
    const allButDept = policy({ id: 'all', scopes: [{ kind: 'EXCLUDE', targetType: 'DEPARTMENT', targetId: 'd1' }] });
    expect(pick([allButDept])).toBeNull();
  });
  it('effective dates: not before the start, not after deactivation', () => {
    const later = policy({ id: 'later', effectiveFrom: '2026-12-01' });
    expect(pick([later])).toBeNull();
    const ended = policy({ id: 'ended', effectiveTo: '2026-11-09', isActive: false });
    expect(pick([ended], emp, '2026-11-09')).toBe('ended');
    expect(pick([ended], emp, '2026-11-10')).toBeNull();
  });
  it('inactive policy with no end date never applies', () => {
    expect(pick([policy({ id: 'off', isActive: false })])).toBeNull();
  });
  it('same specificity: newest effective date wins', () => {
    const v1 = policy({ id: 'v1', effectiveFrom: '2026-01-01' });
    const v2 = policy({ id: 'v2', effectiveFrom: '2026-10-01' });
    expect(pick([v1, v2])).toBe('v2');
    expect(pick([v1, v2], emp, '2026-09-30')).toBe('v1');
  });
});
