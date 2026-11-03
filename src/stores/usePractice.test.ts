import type { SrsCard } from '../data/models';
import { computePathState } from '../domain/progression/pathState';
import { buildPracticeSession, practiceDueCount, selectPracticeItems } from './usePractice';

/**
 * Fake manifest: buildUnit(1) + the "frases" bank, served by a real content loader over
 * in-memory importers (the bundled content has no banks yet).
 */
vi.mock('../content/loader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../content/loader')>();
  const { buildManifest } = await import('../content/buildManifest');
  const { unitSchema } = await import('../content/schema');
  const { bankSchema } = await import('../content/schemas/course');
  const { buildUnit } = await import('../test/fixtures/buildUnit');
  const { buildBank } = await import('../test/fixtures/content/buildBank');
  const unit = buildUnit(1);
  const bank = buildBank();
  const manifest = buildManifest({
    units: [{ unit: unitSchema.parse(unit), file: 't1.json' }],
    banks: [{ bank: bankSchema.parse(bank), file: 'frases.json' }],
  });
  const loader = actual.createContentLoader(manifest, {
    units: { './units/t1.json': async () => ({ default: unit }) },
    banks: { './banks/frases.json': async () => ({ default: bank }) },
    maps: {},
    plans: {},
    collections: {},
  });
  return {
    ...actual,
    getCourseManifest: () => manifest,
    pathUnits: () => manifest.units,
    manifestItemIds: (unitIds?: readonly string[]) => actual.itemIdsOf(manifest, unitIds),
    loadItems: loader.loadItems,
  };
});

const card = (itemId: string, dueDay = '2000-01-01'): SrsCard => ({
  itemId,
  ease: 2.5,
  intervalDays: 1,
  reps: 1,
  lapses: 0,
  dueDay,
  lastReviewDay: '1999-12-31',
});
const caps = { tts: false, stt: false, speakDisabled: true };

describe('practice with bank items (MAPAS-E-CARTAS §3)', () => {
  const units = [
    {
      id: 't1-unit',
      skills: [1, 2, 3, 4].map((s) => ({
        id: `t1-sk${s}`,
        lessons: [1, 2, 3].map((l) => ({ id: `t1-sk${s}-l${l}` })),
      })),
      reviewLesson: { id: 't1-review' },
    },
  ];
  const path = computePathState({ units }, []);

  it('a due card of a bank item counts and is selected', () => {
    const cards = [card('fr-001'), card('t1-sk1-word'), card('gone-item')];
    expect(practiceDueCount(cards)).toBe(2);
    expect(selectPracticeItems(cards, path)).toEqual(expect.arrayContaining(['fr-001']));
  });

  it('the session loads the bank and practices its item', async () => {
    const session = await buildPracticeSession([card('fr-001')], path, caps);
    expect(session).not.toBeNull();
    const practiced = new Set(session!.exercises.flatMap((e) => e.itemIds));
    expect(practiced.has('fr-001')).toBe(true);
  });
});
