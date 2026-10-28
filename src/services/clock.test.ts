import { clock } from './clock';

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
});
