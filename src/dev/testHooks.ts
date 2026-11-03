import { repository } from '../data';
import { exportFileSchema } from '../data/models';

type FakePermission = NotificationPermission | 'unsupported';
const NOTIFICATION_KEY = 'falae-test-notification';

/** Replaces window.Notification with a stub that answers `state` (or removes it: 'unsupported'). */
function installNotificationStub(state: FakePermission): void {
  if (state === 'unsupported') {
    Reflect.deleteProperty(window, 'Notification');
    return;
  }
  let permission: NotificationPermission = state;
  const Stub = function Notification() {} as unknown as typeof Notification; // test-only stub
  Object.defineProperty(Stub, 'permission', { get: () => permission, configurable: true });
  Object.defineProperty(Stub, 'requestPermission', {
    configurable: true,
    // A 'default' stub grants on request; 'denied'/'granted' keep their answer.
    value: async () => (permission = state === 'default' ? 'granted' : state),
  });
  Object.defineProperty(window, 'Notification', {
    value: Stub,
    configurable: true,
    writable: true,
  });
}

/** E2E builds only: lets Playwright seed a profile/progress through the real import path. */
export function exposeImportForTesting(): void {
  if (import.meta.env.VITE_E2E !== '1') return;
  const hooks = window.__falae;
  if (!hooks) return;
  hooks.importForTest = async (file: unknown) => {
    await repository.importAll(exportFileSchema.parse(file));
  };
  hooks.exportForTest = () => repository.exportAll();
  hooks.seedSrs = async (cards: unknown) => {
    const current = await repository.exportAll();
    await repository.importAll(
      exportFileSchema.parse({ ...current, data: { ...current.data, srs: cards } }),
    );
  };
  hooks.notificationPermission = (state: FakePermission) => {
    try {
      sessionStorage.setItem(NOTIFICATION_KEY, state);
    } catch {
      // ignore
    }
    installNotificationStub(state);
  };
  // The stub must survive reloads, like the simulated clock.
  try {
    const saved = sessionStorage.getItem(NOTIFICATION_KEY);
    if (saved === 'default' || saved === 'denied' || saved === 'granted' || saved === 'unsupported')
      installNotificationStub(saved);
  } catch {
    // ignore
  }
}

/** E2E builds only: existing specs start with onboarding already done (see playwright.config). */
export const E2E_ONBOARDED_KEY = 'falae-e2e-onboarded';
export function e2eSkipsOnboarding(): boolean {
  try {
    return localStorage.getItem(E2E_ONBOARDED_KEY) === '1';
  } catch {
    return false;
  }
}
