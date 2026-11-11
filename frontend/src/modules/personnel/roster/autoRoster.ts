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
//  - shifts are shuffled day by day but kept fair: each slot goes to whoever
//    has had that shift the fewest times, so everyone ends up with about the
//    same number of each shift and nobody is stuck on one;
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
  // Fair mix: every person keeps a running count of how many days they've
  // had each shift, and each day a slot goes to whoever has done that shift
  // the fewest times -- so over the period everyone ends up with about the
  // same number of Mornings, Evenings and Nights, and nobody is stuck on one.
  const shortfalls: AutoShortfall[] = [];
  const tally = new Map<string, Map<string, number>>();
  const countOf = (e: string, sid: string) => tally.get(e)?.get(sid) ?? 0;
  const bump = (e: string, sid: string) => {
    const m = tally.get(e) ?? new Map<string, number>();
    m.set(sid, (m.get(sid) ?? 0) + 1);
    tally.set(e, m);
  };
  // Shifts already on the roster in this range count towards the mix too.
  if (keepExisting) {
    for (const e of employeeIds) {
      for (const d of dates) {
        const ex = lookup(e, d);
        if (ex?.type === 'SHIFT' && ex.shiftId) bump(e, ex.shiftId);
      }
    }
  }

  if (shifts.length > 0) {
    for (const date of dates) {
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

      const free = new Set(workers);
      const assign = (e: string, sid: string) => {
        cells.set(key(e, date), { employeeId: e, date, type: 'SHIFT', shiftId: sid });
        bump(e, sid);
        given.set(sid, (given.get(sid) ?? 0) + 1);
        needs.set(sid, Math.max(0, (needs.get(sid) ?? 0) - 1));
        free.delete(e);
      };

      // One slot per person a shift still needs today, taken in random order;
      // each goes to the free person who has had that shift the least.
      const slots: string[] = [];
      for (const s of shifts) for (let i = 0; i < (needs.get(s.id) ?? 0); i++) slots.push(s.id);
      for (const sid of shuffle(slots)) {
        if (free.size === 0) break;
        let least = Infinity;
        let pool: string[] = [];
        for (const e of free) {
          const c = countOf(e, sid);
          if (c < least) {
            least = c;
            pool = [e];
          } else if (c === least) pool.push(e);
        }
        assign(pool[Math.floor(Math.random() * pool.length)], sid);
      }

      // More people than the shifts asked for -- spread the extras over the
      // shifts that are fullest relative to their target, again preferring
      // the shift each person has had the least.
      if (fillEveryone) {
        for (const e of shuffle([...free])) {
          let best = shifts[0].id;
          let bestScore = Infinity;
          for (const s of shifts) {
            const score = (given.get(s.id) ?? 0) / s.count + countOf(e, s.id) * 0.001;
            if (score < bestScore) {
              best = s.id;
              bestScore = score;
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
