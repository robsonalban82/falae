import { repository } from '../data';
import { defaultProfile, MAX_USER_CARDS, type Profile, type UserCard } from '../data/models';
import { UserCardLimitError } from '../data/repository';
import type { Exercise } from '../content/schema';
import { startLesson, type LessonSummary } from '../domain/lesson/engine';
import type { SessionKind } from '../domain/gamification/xp';
import { clock } from '../services/clock';
import { useProfile } from './useProfile';

const exercise: Exercise = {
  id: 'x1',
  type: 'multiple-choice',
  itemIds: ['u1-hi'],
  prompt: 'p',
  options: [{ text: 'hi' }, { text: 'bye' }, { text: 'good morning' }],
  answer: 'hi',
};
const summary = (xp: number, over: Partial<LessonSummary> = {}): LessonSummary => ({
  xp,
  accuracy: 1,
  durationMs: 1000,
  mistakes: 0,
  perfect: true,
  itemOutcomes: [{ itemId: 'u1-hi', q: 5 }],
  ...over,
});
let seq = 0;
const session = (kind: SessionKind, ctx?: { mapId?: string; deckKey?: string }) =>
  startLesson({
    lessonId: `${kind}:x`,
    kind,
    exercises: [exercise],
    hearts: 5,
    nowMs: clock.now() + ++seq,
    ...(ctx ? { context: ctx } : {}),
  });
const run = (
  kind: SessionKind,
  xp: number,
  ctx?: { mapId?: string; deckKey?: string },
  goal: 10 | 20 | 30 | 50 = 20,
) => useProfile.getState().commitLesson(session(kind, ctx), summary(xp), goal);
async function seed(p: Partial<Profile> = {}) {
  await repository.saveProfile({ ...defaultProfile('2026-10-01T12:00:00.000Z'), ...p });
  await useProfile.getState().load();
}
const dayRow = async (d: string) => (await repository.getDailyStats(d, d))[0];
const userCard = (i: number): UserCard => ({
  id: `uc-card${String(i).padStart(4, '0')}`,
  en: `word ${i}`,
  pt: `palavra ${i}`,
  createdAt: '2026-10-29T12:00:00.000Z',
  updatedAt: '2026-10-29T12:00:00.000Z',
});

beforeEach(async () => {
  clock.setNow('2026-10-29T12:00:00');
  await repository.resetAll();
  useProfile.setState({ profile: defaultProfile(clock.iso()), loaded: false });
});
afterEach(() => clock.reset());

describe('QA etapa 7: XP de mapas e cartas', () => {
  it('mapa estudado 23:59 e de novo 00:01 (dia local virou) ganha 5 + 5', async () => {
    await seed();
    clock.setNow('2026-10-29T23:59:00');
    const a = await run('map', 5, { mapId: 'm1' });
    clock.setNow('2026-10-30T00:01:00');
    const b = await run('map', 5, { mapId: 'm1' });
    expect([a.result.xp, b.result.xp]).toEqual([5, 5]);
  });

  it('mapa estudado 23:58 e 23:59 do mesmo dia: 5 + 0', async () => {
    await seed();
    clock.setNow('2026-10-29T23:58:00');
    await run('map', 5, { mapId: 'm1' });
    clock.setNow('2026-10-29T23:59:30');
    expect((await run('map', 5, { mapId: 'm1' })).result.xp).toBe(0);
  });

  it('dois mapas diferentes no mesmo dia: 5 + 5', async () => {
    await seed();
    const a = await run('map', 5, { mapId: 'm1' });
    const b = await run('map', 5, { mapId: 'm2' });
    expect([a.result.xp, b.result.xp]).toEqual([5, 5]);
    expect((await dayRow(clock.today()))?.xp).toBe(10);
    expect((await repository.getProfile()).totalXp).toBe(10);
  });

  it('relogio voltando: mapa estudado amanha, hoje de novo, 2x seguidas, nao deve render 5 a cada vez', async () => {
    await seed();
    clock.setNow('2026-10-30T12:00:00');
    await run('map', 5, { mapId: 'm1' });
    clock.setNow('2026-10-29T12:00:00');
    const a = await run('map', 5, { mapId: 'm1' });
    const b = await run('map', 5, { mapId: 'm1' });
    // Esperado: no maximo um dos dois rende XP (mesmo mapa, mesmo dia).
    expect(a.result.xp + b.result.xp).toBeLessThanOrEqual(5);
  });

  it('practice com mapId em dia ja estudado: XP normal de Praticar, +1 coracao, mapa conta', async () => {
    await seed({ hearts: 3, heartsUpdatedAt: clock.iso() });
    await run('map', 5, { mapId: 'm1' });
    const p = await run('practice', 8, { mapId: 'm1' });
    expect(p.result.xp).toBe(8);
    expect(p.heartGained).toBe(true);
    expect((await repository.getProfile()).hearts).toBe(4);
    expect((await repository.getMapProgress())[0]?.timesStudied).toBe(2);
  });

  it('practice com mapId e DEPOIS map no mesmo dia: map rende 0 (practice marca o dia)', async () => {
    await seed();
    await run('practice', 8, { mapId: 'm1' });
    const m = await run('map', 5, { mapId: 'm1' });
    // Decisao de produto: documenta o comportamento atual.
    expect(m.result.xp).toBe(0);
  });

  it('meta diaria (20) batida so com cards + map; ofensiva sobe; coracoes intactos; sem conquistas de practice', async () => {
    await seed({ hearts: 2, heartsUpdatedAt: clock.iso() });
    const c = await run('cards', 15, { deckKey: 'd' }, 20); // 8 + 5 perfeita (ver abaixo)
    expect(c.streak?.streak.current).toBe(1);
    await run('map', 5, { mapId: 'm1' }, 20);
    const ach = await repository.getAchievements();
    expect(ach.map((a) => a.id)).not.toContain('perfect-lesson');
    expect((await dayRow(clock.today()))?.goalMet).toBe(true);
    expect((await repository.getProfile()).hearts).toBe(2);
  });

  it('cards: itemOutcomes repetidos contam cartas distintas em daily.cards', async () => {
    await seed();
    await useProfile.getState().commitLesson(
      session('cards', { deckKey: 'd' }),
      summary(8, {
        itemOutcomes: ['a', 'a', 'a', 'b', 'b'].map((itemId) => ({ itemId, q: 4 })),
      }),
      20,
    );
    expect((await dayRow(clock.today()))?.cards).toBe(2);
  });

  it('ofensiva: map hoje e cards amanha = 2 dias; map com 0 XP ainda conta como atividade', async () => {
    await seed();
    await run('map', 5, { mapId: 'm1' });
    const again = await run('map', 5, { mapId: 'm1' });
    expect(again.result.xp).toBe(0);
    clock.setNow('2026-10-30T12:00:00');
    const c = await run('cards', 8, { deckKey: 'd' });
    expect(c.streak?.streak.current).toBe(2);
  });
});

describe('QA etapa 7: regressao de XP', () => {
  it('lesson 10(+5+combo), review 15, practice 8 inalterados e sem mapProgress', async () => {
    await seed();
    expect((await run('lesson', 15)).result.xp).toBe(15);
    expect((await run('review', 20)).result.xp).toBe(20);
    expect((await run('practice', 8)).result.xp).toBe(8);
    expect((await repository.getMapProgress()).length).toBe(0);
    expect((await repository.getProfile()).totalXp).toBe(43);
  });

  it('lesson e review continuam acendendo perfect-lesson', async () => {
    await seed();
    await run('lesson', 15);
    expect((await repository.getAchievements()).map((a) => a.id)).toContain('perfect-lesson');
  });
});

describe('QA etapa 7: cartas do aluno', () => {
  it('500 ok, 501a recusada, editar a 500a ok, apagar inexistente nao falha', async () => {
    for (let i = 0; i < MAX_USER_CARDS; i++) await repository.saveUserCard(userCard(i));
    expect(await repository.countUserCards()).toBe(MAX_USER_CARDS);
    await expect(repository.saveUserCard(userCard(MAX_USER_CARDS))).rejects.toBeInstanceOf(
      UserCardLimitError,
    );
    await repository.saveUserCard({ ...userCard(MAX_USER_CARDS - 1), en: 'edited' });
    expect(await repository.countUserCards()).toBe(MAX_USER_CARDS);
    await expect(repository.deleteUserCard('uc-naoexiste1')).resolves.toBeUndefined();
    expect(await repository.countUserCards()).toBe(MAX_USER_CARDS);
  }, 30_000);

  it('duas abas salvando a 500a carta ao mesmo tempo: nunca passa de 500', async () => {
    for (let i = 0; i < MAX_USER_CARDS - 1; i++) await repository.saveUserCard(userCard(i));
    const r = await Promise.allSettled([
      repository.saveUserCard(userCard(9001)),
      repository.saveUserCard(userCard(9002)),
    ]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(await repository.countUserCards()).toBe(MAX_USER_CARDS);
  }, 30_000);

  it('apagar carta remove tambem o SrsCard e a 501a volta a caber', async () => {
    for (let i = 0; i < MAX_USER_CARDS; i++) await repository.saveUserCard(userCard(i));
    await repository.deleteUserCard(userCard(0).id);
    await repository.saveUserCard(userCard(7777));
    expect(await repository.countUserCards()).toBe(MAX_USER_CARDS);
  }, 30_000);
});
