import {
  currentPermission,
  isSupported,
  LAST_SHOWN_KEY,
  msUntilNext,
  requestPermission,
  shouldNotify,
  showReminder,
} from './notifications';

const at = (iso: string) => new Date(iso).getTime();

type FakeNotification = {
  permission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
};

function installNotification(permission: NotificationPermission, answer = permission) {
  const fake: FakeNotification = {
    permission,
    requestPermission: vi.fn(async () => {
      fake.permission = answer;
      return answer;
    }),
  };
  vi.stubGlobal('Notification', fake);
  const showNotification = vi.fn(async () => {});
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({ showNotification }) },
  });
  return { fake, showNotification };
}

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'serviceWorker');
  localStorage.clear();
});

describe('support and permission', () => {
  it('is unsupported without Notification or service worker', () => {
    expect(isSupported()).toBe(false);
    expect(currentPermission()).toBe('unsupported');
  });

  it('asks for permission only when called and reports the answer', async () => {
    const { fake } = installNotification('default', 'granted');
    expect(fake.requestPermission).not.toHaveBeenCalled();
    expect(await requestPermission()).toBe('granted');
    expect(currentPermission()).toBe('granted');
  });

  it('denied stays denied', async () => {
    installNotification('default', 'denied');
    expect(await requestPermission()).toBe('denied');
  });
});

describe('schedule', () => {
  it('next occurrence is today if ahead, else tomorrow', () => {
    expect(msUntilNext('19:00', at('2026-10-29T18:30:00'))).toBe(30 * 60_000);
    expect(msUntilNext('19:00', at('2026-10-29T19:30:00'))).toBe(23.5 * 3_600_000);
  });

  it('keeps the local time across DST (America/New_York, 1 Nov 2026)', () => {
    expect(msUntilNext('19:00', at('2026-10-31T20:00:00'))).toBe(24 * 3_600_000);
  });

  it('notifies only after the time, without study today, once per day', () => {
    const base = { time: '19:00', studiedToday: false, lastShownDay: null };
    expect(shouldNotify({ ...base, nowMs: at('2026-10-29T18:59:00') })).toBe(false);
    expect(shouldNotify({ ...base, nowMs: at('2026-10-29T19:00:00') })).toBe(true);
    expect(shouldNotify({ ...base, nowMs: at('2026-10-29T20:00:00'), studiedToday: true })).toBe(
      false,
    );
    expect(
      shouldNotify({ ...base, nowMs: at('2026-10-29T20:00:00'), lastShownDay: '2026-10-29' }),
    ).toBe(false);
    expect(
      shouldNotify({ ...base, nowMs: at('2026-10-30T20:00:00'), lastShownDay: '2026-10-29' }),
    ).toBe(true);
  });
});

describe('showReminder', () => {
  it('shows through the service worker with a tag and remembers the day', async () => {
    const { showNotification } = installNotification('granted');
    expect(await showReminder({ title: 'T', body: 'B' }, at('2026-10-29T20:00:00'))).toBe(true);
    expect(showNotification).toHaveBeenCalledWith(
      'T',
      expect.objectContaining({ body: 'B', tag: 'falae-daily' }),
    );
    expect(localStorage.getItem(LAST_SHOWN_KEY)).toBe('2026-10-29');
  });

  it('does nothing without permission', async () => {
    const { showNotification } = installNotification('denied');
    expect(await showReminder({ title: 'T', body: 'B' }, Date.now())).toBe(false);
    expect(showNotification).not.toHaveBeenCalled();
  });
});
