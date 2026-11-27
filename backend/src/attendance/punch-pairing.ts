/**
 * Picks a day's check-in / check-out from its raw punches.
 *
 * Why not use each punch's IN/OUT flag: the real ZKTeco client can't read the
 * device's direction (node-zklib drops it), so it guesses by alternating IN/OUT
 * across an employee's whole history. One missed or doubled punch flips every
 * later day, and a check-in/check-out built from those flags comes out swapped.
 * The earliest and latest punch of the day don't depend on that guess.
 *
 * Rules:
 *  - check-in  = the earliest punch of the day;
 *  - check-out = the latest punch, but only if it is at least MIN_GAP_MINUTES
 *    after the check-in (a double swipe is one punch, not an in and an out);
 *  - a manual punch (HR fixing a missed swipe) is just another punch here, so
 *    a manual IN earlier than the device's first punch becomes the check-in.
 */
export const MIN_GAP_MINUTES = 1;

export interface PunchLike {
  timestamp: Date;
}

export function pickCheckInOut(punches: PunchLike[]): { checkIn: Date; checkOut: Date | null } | null {
  if (punches.length === 0) return null;

  let first = punches[0].timestamp;
  let last = punches[0].timestamp;
  for (const p of punches) {
    if (p.timestamp < first) first = p.timestamp;
    if (p.timestamp > last) last = p.timestamp;
  }

  const gapMs = last.getTime() - first.getTime();
  return { checkIn: first, checkOut: gapMs >= MIN_GAP_MINUTES * 60_000 ? last : null };
}
