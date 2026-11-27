import { pickCheckInOut } from './punch-pairing';

const at = (hhmm: string) => ({ timestamp: new Date(`2026-11-10T${hhmm}:00`) });

describe('pickCheckInOut', () => {
  it('returns null with no punches', () => {
    expect(pickCheckInOut([])).toBeNull();
  });

  it('first punch is the check-in, last is the check-out', () => {
    const r = pickCheckInOut([at('09:02'), at('13:00'), at('17:30')])!;
    expect(r.checkIn).toEqual(at('09:02').timestamp);
    expect(r.checkOut).toEqual(at('17:30').timestamp);
  });

  it('does not depend on the order the punches arrive in', () => {
    const r = pickCheckInOut([at('17:30'), at('09:02')])!;
    expect(r.checkIn).toEqual(at('09:02').timestamp);
    expect(r.checkOut).toEqual(at('17:30').timestamp);
  });

  it('a single punch is a check-in with no check-out', () => {
    const r = pickCheckInOut([at('09:02')])!;
    expect(r.checkIn).toEqual(at('09:02').timestamp);
    expect(r.checkOut).toBeNull();
  });

  it('a double swipe is one punch, not an in and an out', () => {
    const r = pickCheckInOut([{ timestamp: new Date('2026-11-10T09:02:00') }, { timestamp: new Date('2026-11-10T09:02:20') }])!;
    expect(r.checkOut).toBeNull();
  });

  it('a manual early check-in wins over the device punch', () => {
    const r = pickCheckInOut([at('10:30'), at('09:00'), at('18:00')])!;
    expect(r.checkIn).toEqual(at('09:00').timestamp);
  });

  it('check-out is never before check-in', () => {
    const r = pickCheckInOut([at('18:00'), at('09:00')])!;
    expect(r.checkOut!.getTime()).toBeGreaterThan(r.checkIn.getTime());
  });
});
