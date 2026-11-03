import { parseExportFile } from './exportImport';
import { defaultProfile, defaultSettings } from './models';

const D = '2026-10-29';
const valid = () => ({
  app: 'falae',
  schemaVersion: 1,
  exportedAt: '2026-10-29T12:00:00.000Z',
  data: {
    profile: { ...defaultProfile('2026-10-01T12:00:00.000Z'), totalXp: 70 },
    settings: { ...defaultSettings(), theme: 'dark' },
    lessonProgress: [],
    results: [],
    srs: [],
    daily: [],
    achievements: [],
  },
});

describe('parseExportFile — hostile files', () => {
  it.each([
    ['empty', ''],
    ['null', 'null'],
    ['array', '[]'],
    ['number', '42'],
    ['truncated', JSON.stringify(valid()).slice(0, 80)],
  ])('%s never throws', (_, text) => {
    const r = parseExportFile(text, D);
    expect(r.ok).toBe(false);
  });

  it('other app → notFalae', () => {
    expect(parseExportFile(JSON.stringify({ ...valid(), app: 'duo' }), D)).toMatchObject({
      ok: false,
      reason: 'notFalae',
    });
  });
  it('newer version (3) → newerVersion; older/garbage version → invalid', () => {
    expect(parseExportFile(JSON.stringify({ ...valid(), schemaVersion: 3 }), D)).toMatchObject({
      reason: 'newerVersion',
    });
    expect(parseExportFile(JSON.stringify({ ...valid(), schemaVersion: 0 }), D)).toMatchObject({
      reason: 'invalid',
    });
    expect(parseExportFile(JSON.stringify({ ...valid(), schemaVersion: '1' }), D)).toMatchObject({
      ok: false,
    });
  });
  it('invalid values report at most 3 issues', () => {
    const f = valid() as Record<string, unknown> & ReturnType<typeof valid>;
    const bad = {
      ...f,
      data: {
        ...f.data,
        profile: { ...f.data.profile, totalXp: -1, hearts: 99, id: 7 },
        srs: [{ itemId: 1 }],
      },
    };
    const r = parseExportFile(JSON.stringify(bad), D);
    expect(r.ok).toBe(false);
    if (!r.ok) expect((r.issues ?? []).length).toBeLessThanOrEqual(3);
  });
  it('BOM + different theme parses and keeps the theme', () => {
    const r = parseExportFile('﻿' + JSON.stringify(valid()), D);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.file.data.settings.theme).toBe('dark');
      expect(r.summary.totalXp).toBe(70);
    }
  });
});
