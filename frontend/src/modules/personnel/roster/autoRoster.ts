// Random roster generator behind "Assign Multiple" > Auto roster.
//
// Pure function (no React, no network): given who, which days, how many
// people each shift needs and what's already on the roster, it works out a
// fair random roster. The Roster screen stages the result as unsaved edits,
// so the manager can change anything before pressing Save.
//
// Rules it follows:
//  - every person gets ONE day off per week (a week = Mon-Sun); days off are
//    spread so the same weekday isn't empty for everybody;
//  - each day, every shift is filled up to the number of people asked for;
//  - people keep the same shift through a week and rotate to the next shift
//    the following week, so nobody is stuck on one forever;
//  - extra people (more staff than the shifts need) are spread across the
//    shifts when `fillEveryone` is on, otherwise they're left unassigned;
//  - with `keepExisting`, any day that already has a duty is left alone (an
//    existing shift still counts towards that day's headcount, an existing
//    day off counts as that week's day off).

export interface AutoCell {
  employeeId: string;
  date: string; // YYYY-MM-DD
  type: 'SHIFT' | 'OFF';
  shiftId?: string;
}

export interface AutoShortfall {
  date: string;
  shiftId: string;
  missing: number;
}

export interface AutoInput {
  employeeIds: string[];
  /** Days to fill, YYYY-MM-DD, ascending. */
  dates: string[];
  /** Shifts to use, in rotation order, with how many people each needs per day. */
  shifts: { id: string; count: number }[];
  weeklyOff: boolean;
  keepExisting: boolean;
  fillEveryone: boolean;
  /** What a cell already holds (saved or staged), for ANY date. */
  lookup: (employeeId: string, date: string) => { type: 'SHIFT' | 'OFF'; shiftId?: string } | undefined;
}

export interface AutoResult {
  cells: AutoCell[];
  offs: number;
  shifts: number;
  shortfalls: AutoShortfall[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const DAY = 86400000;

function addDaysStr(date: string, n: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + n * DAY).toISOString().slice(0, 10);
}

/** Monday (YYYY-MM-DD) of the week a date falls in. */
function mondayStr(date: string): string {
  const dow = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDaysStr(date, -dow);
}

export function generateRoster(input: AutoInput): AutoResult {
  const { employeeIds, dates, weeklyOff, keepExisting, fillEveryone, lookup } = input;
  const shifts = input.shifts.filter((s) => s.count > 0);
  const dateSet = new Set(dates);
  const cells = new Map<string, AutoCell>();
  const key = (e: string, d: string) => `${e}|${d}`;

  // A cell we must not touch: outside the range, or already holding a duty
  // while "keep existing" is on.
  const locked = (e: string, d: string) => !dateSet.has(d) || (keepExisting && !!lookup(e, d));

  // ---- 1. one day off per person per week ---------------------------------
  const offCount = new Map<string, number>();
  if (keepExisting) {
    for (const e of employeeIds) {
      for (const d of dates) if (lookup(e, d)?.type === 'OFF') offCount.set(d, (offCount.get(d) ?? 0) + 1);
    }
  }

  if (weeklyOff) {
    const weeks = new Map<string, string[]>();
    for (const d of dates) {
      const m = mondayStr(d);
      weeks.set(m, [...(weeks.get(m) ?? []), d]);
    }
    for (const [monday, wdates] of weeks) {
      // A sliver of a week (under 4 days) is left alone so a week split
      // across two ranges doesn't end up with two days off.
      if (wdates.length < 4) continue;
      const fullWeek = Array.from({ length: 7 }, (_, i) => addDaysStr(monday, i));
      for (const e of shuffle(employeeIds)) {
        // Already has a day off this week (outside the range, or kept)?
        const hasOff = fullWeek.some((d) => {
          if (dateSet.has(d) && !keepExisting) return false;
          return lookup(e, d)?.type === 'OFF';
        });
        if (hasOff) continue;
        const cands = wdates.filter((d) => !locked(e, d));
        if (cands.length === 0) continue;
        // Pick the day with the fewest people already off, ties at random.
        const least = Math.min(...cands.map((d) => offCount.get(d) ?? 0));
        const pool = cands.filter((d) => (offCount.get(d) ?? 0) === least);
        const day = pool[Math.floor(Math.random() * pool.length)];
        cells.set(key(e, day), { employeeId: e, date: day, type: 'OFF' });
        offCount.set(day, (offCount.get(day) ?? 0) + 1);
      }
    }
  }

  // ---- 2. fill the shifts, day by day --------------------------------------
  const shortfalls: AutoShortfall[] = [];
  const lastShift = new Map<string, string>();
  let prevWeek = '';

  if (shifts.length > 0) {
    const order = shifts.map((s) => s.id);
    for (const date of dates) {
      const week = mondayStr(date);
      if (week !== prevWeek) {
        // New week: everyone rotates to the next shift in the list.
        for (const [e, sid] of lastShift) lastShift.set(e, order[(order.indexOf(sid) + 1) % order.length]);
        prevWeek = week;
      }

      const needs = new Map(shifts.map((s) => [s.id, s.count]));
      const given = new Map(shifts.map((s) => [s.id, 0]));
      const workers: string[] = [];

      for (const e of employeeIds) {
        if (cells.has(key(e, date))) continue; // generated day off
        const ex = keepExisting ? lookup(e, date) : undefined;
        if (ex) {
          // Existing duty stays; an existing shift still counts to the headcount.
          if (ex.type === 'SHIFT' && ex.shiftId && needs.has(ex.shiftId)) {
            needs.set(ex.shiftId, Math.max(0, needs.get(ex.shiftId)! - 1));
          }
          continue;
        }
        workers.push(e);
      }

      const assign = (e: string, sid: string) => {
        cells.set(key(e, date), { employeeId: e, date, type: 'SHIFT', shiftId: sid });
        lastShift.set(e, sid);
        given.set(sid, (given.get(sid) ?? 0) + 1);
        needs.set(sid, Math.max(0, (needs.get(sid) ?? 0) - 1));
      };

      // Pass 1: stay on the shift they were on (or rotated to) if it still needs people.
      const unplaced: string[] = [];
      for (const e of shuffle(workers)) {
        const pref = lastShift.get(e);
        if (pref && (needs.get(pref) ?? 0) > 0) assign(e, pref);
        else unplaced.push(e);
      }
      // Pass 2: send the rest to whichever shift is shortest.
      const extra: string[] = [];
      for (const e of unplaced) {
        let best = '';
        let bestNeed = 0;
        for (const s of shifts) {
          const n = needs.get(s.id) ?? 0;
          if (n > bestNeed) {
            best = s.id;
            bestNeed = n;
          }
        }
        if (best) assign(e, best);
        else extra.push(e);
      }
      // Pass 3: more people than the shifts asked for -- spread them out.
      if (fillEveryone) {
        for (const e of extra) {
          const pref = lastShift.get(e);
          let best = shifts[0].id;
          let bestRatio = Infinity;
          for (const s of shifts) {
            const ratio = (given.get(s.id) ?? 0) / s.count - (s.id === pref ? 0.01 : 0);
            if (ratio < bestRatio) {
              best = s.id;
              bestRatio = ratio;
            }
          }
          assign(e, best);
        }
      }

      for (const s of shifts) {
        const missing = needs.get(s.id) ?? 0;
        if (missing > 0) shortfalls.push({ date, shiftId: s.id, missing });
      }
    }
  }

  const out = [...cells.values()];
  return {
    cells: out,
    offs: out.filter((c) => c.type === 'OFF').length,
    shifts: out.filter((c) => c.type === 'SHIFT').length,
    shortfalls,
  };
}
