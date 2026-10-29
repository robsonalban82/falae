import { clock, exposeClockForTesting } from './clock';

afterEach(() => clock.reset());

describe('clock', () => {
  it('can be fixed and advanced', () => {
    clock.setNow('2026-10-28T10:00:00');
    expect(clock.today()).toBe('2026-10-28');
    clock.advance(86_400_000);
    expect(clock.today()).toBe('2026-10-29');
  });

  it('applies an offset when not fixed', () => {
    const before = Date.now();
    clock.advance(3_600_000);
    expect(clock.now()).toBeGreaterThanOrEqual(before + 3_600_000);
  });

  it('localHour follows the simulated local time', () => {
    clock.setNow('2026-10-28T07:45:00');
    expect(clock.localHour()).toBe(7);
  });

  it('test hooks persist the simulated clock across reloads (sessionStorage)', () => {
    sessionStorage.clear();
    exposeClockForTesting();
    window.__falae?.setNow('2026-10-28T10:00:00');
    window.__falae?.advanceDays(2);
    expect(window.__falae?.today()).toBe('2026-10-30');
    clock.reset(); // simulates a fresh page
    exposeClockForTesting();
    expect(clock.today()).toBe('2026-10-30');
    window.__falae?.reset();
    sessionStorage.clear();
  });
});
