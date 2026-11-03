import { demoUnit } from '../dev/demoUnit';
import { formatIssues, unitSchema } from './schema';

// QA: the E2E build (VITE_DEMO=1) evaluates the demo unit when loader.ts is imported.
// An invalid demo unit throws a ZodError at boot and the whole E2E suite sees a blank page.

describe('demo unit (VITE_DEMO builds)', () => {
  it('follows the unit schema', () => {
    const parsed = unitSchema.safeParse(demoUnit);
    expect(parsed.success ? [] : formatIssues(parsed.error)).toEqual([]);
  });

  it('importing the loader with VITE_DEMO=1 does not throw and lists the demo unit', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_DEMO', '1');
    try {
      const loader = await import('./loader');
      expect(loader.getCourseManifest().units.some((u) => loader.isDemoUnit(u.id))).toBe(true);
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  it('an invalid demo unit never throws at import: it stays out and loading it is a ContentLoadError', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.resetModules();
    vi.stubEnv('VITE_DEMO', '1');
    const real = await vi.importActual<typeof import('../dev/demoUnit')>('../dev/demoUnit');
    const broken: Record<string, unknown> = { ...real.demoUnit };
    delete broken.level; // the field the schema requires
    vi.doMock('../dev/demoUnit', () => ({ ...real, demoUnit: broken }));
    try {
      const loader = await import('./loader');
      expect(loader.getCourseManifest().units.some((u) => u.id === real.DEMO_UNIT_ID)).toBe(false);
      expect(loader.findLesson(`${real.DEMO_UNIT_ID.replace(/-unit$/, '')}-sk1-l1`)).toBeNull();
      await expect(loader.loadUnit(real.DEMO_UNIT_ID)).rejects.toMatchObject({
        name: 'ContentLoadError',
      });
      // real units still load
      const first = loader.pathUnits()[0]!;
      expect((await loader.loadUnit(first.id)).id).toBe(first.id);
      expect(error).toHaveBeenCalledWith(expect.stringContaining('Unidade demo inválida'));
    } finally {
      vi.doUnmock('../dev/demoUnit');
      vi.unstubAllEnvs();
      vi.resetModules();
      error.mockRestore();
    }
  });
});
