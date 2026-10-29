import { courseManifest } from './manifest.generated';
import { ContentLoadError, createUnitLoader, findLesson, findSkillUnit, pathUnits } from './loader';

const real = import.meta.glob<{ default: unknown }>('./units/*.json');

function spiedImporters() {
  const calls: string[] = [];
  const importers = Object.fromEntries(
    Object.entries(real).map(([path, load]) => [
      path,
      () => {
        calls.push(path);
        return load();
      },
    ]),
  );
  return { calls, importers };
}

describe('content loader (lazy units)', () => {
  it('draws the path from the manifest only', () => {
    expect(pathUnits().map((u) => u.id)).toEqual(courseManifest.units.map((u) => u.id));
  });

  it('opening a lesson imports and validates only its unit, once', async () => {
    const { calls, importers } = spiedImporters();
    const loader = createUnitLoader(courseManifest.units, importers);
    const second = courseManifest.units[1]!;
    const lessonId = second.skills[0]!.lessons[0]!.id;
    const where = findLesson(lessonId);
    expect(where).toEqual({ unitId: second.id, skillId: second.skills[0]!.id, index: 0 });

    const unit = await loader.load(where!.unitId);
    await loader.load(where!.unitId);
    expect(unit.id).toBe(second.id);
    expect(calls).toEqual([`./units/${second.file}`]);
  });

  it('finds review lessons and skills', () => {
    const first = courseManifest.units[0]!;
    expect(findLesson(first.reviewLesson.id)).toEqual({
      unitId: first.id,
      skillId: null,
      index: -1,
    });
    expect(findSkillUnit(first.skills[2]!.id)).toBe(first.id);
    expect(findLesson('nope')).toBeNull();
    expect(findSkillUnit('nope')).toBeNull();
  });

  it('rejects invalid content with a typed error (and does not cache the failure)', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    let attempts = 0;
    const unit = courseManifest.units[0]!;
    const loader = createUnitLoader(courseManifest.units, {
      [`./units/${unit.file}`]: async () => {
        attempts++;
        return { default: { id: unit.id, title: 42 } };
      },
    });
    await expect(loader.load(unit.id)).rejects.toMatchObject({
      name: 'ContentLoadError',
      reason: 'invalid',
      unitId: unit.id,
    });
    await expect(loader.load(unit.id)).rejects.toBeInstanceOf(ContentLoadError);
    expect(attempts).toBe(2);
    error.mockRestore();
  });

  it('rejects unknown units as missing', async () => {
    const loader = createUnitLoader(courseManifest.units, {});
    await expect(loader.load('ghost')).rejects.toMatchObject({ reason: 'missing' });
  });
});
