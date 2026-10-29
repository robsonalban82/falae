import { repository } from '../data';
import { exportFileSchema } from '../data/models';

/** E2E builds only: lets Playwright seed a profile/progress through the real import path. */
export function exposeImportForTesting(): void {
  if (import.meta.env.VITE_E2E !== '1') return;
  const hooks = window.__falae;
  if (!hooks) return;
  hooks.importForTest = async (file: unknown) => {
    await repository.importAll(exportFileSchema.parse(file));
  };
}
