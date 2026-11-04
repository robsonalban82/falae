import { toFlashcard } from '../cards/flashcard';
import { filterMaps, parseMapFilters, toSearchParams } from './filter';
import { lineView } from './lines';
import { check, checkAll, initialQuizState, score, shownAnswer, toggleAnswers } from './quiz';
import {
  hideableChunks,
  initialRevealState,
  isComplete,
  mapStudySummary,
  rate as rateIn,
  reveal as revealIn,
  type RevealRating,
  type RevealState,
  resetReveal,
  revealOutcomes,
  toggleReveal,
} from './reveal';
import { fixtureLookup, fixtureMap } from './testFixture';

const on = () => toggleReveal(initialRevealState());
const chunks = hideableChunks(fixtureMap, fixtureLookup);
const reveal = (s: RevealState, key: string) => revealIn(s, key, chunks);
const rate = (s: RevealState, key: string, r: RevealRating) => rateIn(s, key, r, chunks);
const ctx = { knownWords: new Set<string>() };

describe('QA etapa 3: lineView', () => {
  it('ref ausente retorna null, inclusive string vazia', () => {
    expect(lineView({ ref: '' }, 'regra', fixtureLookup)).toBeNull();
    expect(lineView({ ref: 'nope' }, 'vocabulario', fixtureLookup)).toBeNull();
  });
  it('item com padrao (x) e [a|b] mostra a forma concreta', () => {
    const lookup = () => ({ id: 'z', en: "I [am|'m] (really) happy", pt: 'x' });
    const v = lineView({ ref: 'z' }, 'regra', lookup);
    expect(v).toMatchObject({ kind: 'item' });
    if (v?.kind === 'item') expect(v.en).not.toMatch(/[[\]|()]/);
  });
  it('negrito mal fechado nao quebra e fala sem asteriscos pareados', () => {
    const v = lineView({ en: 'you **are' }, 'regra', fixtureLookup);
    expect(v?.kind).toBe('text');
    if (v?.kind === 'text') expect(v.en.map((s) => s.text).join('')).toBe('you **are');
    expect(() => lineView({ en: '****' }, 'regra', fixtureLookup)).not.toThrow();
    expect(() => lineView({ en: '' }, 'regra', fixtureLookup)).not.toThrow();
  });
  it('pt vazio fica presente (sem undefined silencioso)', () => {
    expect(lineView({ en: 'a', pt: '' }, 'regra', fixtureLookup)).toMatchObject({ pt: '' });
  });
});

describe('QA etapa 3: reveal', () => {
  it('revelar duas vezes e chave inexistente', () => {
    const s = reveal(reveal(on(), 'b0.n0.l0'), 'b0.n0.l0');
    expect(s.revealed).toEqual(['b0.n0.l0']);
    // unknown keys are ignored and never count toward completion
    const bogus = reveal(on(), 'zzz');
    expect(bogus.revealed).toEqual([]);
    expect(isComplete(bogus, chunks)).toBe(false);
  });
  it('nota antes de revelar e com modo desligado e ignorada', () => {
    expect(rate(on(), 'b0.n0.l0', 'forgot').ratings).toEqual({});
    expect(rate(initialRevealState(), 'k', 'forgot').ratings).toEqual({});
  });
  it('mesmo item em duas linhas fica com menor q, em qualquer ordem', () => {
    for (const [a, b] of [
      ['remembered', 'forgot'],
      ['forgot', 'remembered'],
    ] as const) {
      let s = on();
      s = reveal(reveal(s, 'b0.n0.l0'), 'b0.n1.l1');
      s = rate(rate(s, 'b0.n0.l0', a), 'b0.n1.l1', b);
      expect(revealOutcomes(s, chunks)).toEqual([{ itemId: 'u1-im', q: 1 }]);
    }
  });
  it('reavaliar substitui a nota', () => {
    let s = reveal(on(), 'b0.n0.l0');
    s = rate(rate(s, 'b0.n0.l0', 'forgot'), 'b0.n0.l0', 'remembered');
    expect(revealOutcomes(s, chunks)).toEqual([{ itemId: 'u1-im', q: 4 }]);
  });
  it('desligar e religar zera tudo', () => {
    let s = reveal(on(), 'b0.n0.l0');
    s = rate(s, 'b0.n0.l0', 'forgot');
    expect(toggleReveal(toggleReveal(s))).toEqual({ on: true, revealed: [], ratings: {} });
    expect(resetReveal(initialRevealState())).toEqual(initialRevealState());
  });
  it('isComplete com 0 trechos: nunca conclui', () => {
    expect(isComplete(initialRevealState(), [])).toBe(false);
    expect(isComplete(on(), [])).toBe(false);
  });
  it('mapa sem trechos gera resumo sem NaN', () => {
    const sum = mapStudySummary(on(), [], 1000, 500);
    expect(sum.accuracy).toBe(1);
    expect(sum.durationMs).toBe(0);
    expect(sum.itemOutcomes).toEqual([]);
    expect(Number.isNaN(sum.accuracy)).toBe(false);
  });
  it('resumo: esqueci conta como erro, accuracy proporcional', () => {
    let s = reveal(reveal(on(), 'b0.n0.l0'), 'b0.n1.l0');
    s = rate(rate(s, 'b0.n0.l0', 'forgot'), 'b0.n1.l0', 'remembered');
    const sum = mapStudySummary(s, chunks, 0, 10);
    expect(sum.mistakes).toBe(1);
    expect(sum.accuracy).toBe(0.5);
    expect(sum.perfect).toBe(false);
  });
});

describe('QA etapa 3: quiz', () => {
  const items = [{ accepted: ['are'] }, { accepted: ["isn't", 'is not'] }, { accepted: [] }];
  it('mapa sem lacunas', () => {
    expect(score(initialQuizState(0))).toEqual({ right: 0, checked: 0, total: 0 });
    expect(checkAll(initialQuizState(0), [], [], ctx).items).toEqual([]);
  });
  it('indice invalido nao muda estado', () => {
    const s = initialQuizState(3);
    expect(check(s, -1, 'are', items, ctx)).toBe(s);
    expect(check(s, 3, 'are', items, ctx)).toBe(s);
    expect(check(s, 1.5, 'are', items, ctx).items).toHaveLength(3);
  });
  it('espacos, caixa e pontuacao', () => {
    expect(check(initialQuizState(3), 0, '  ARE  ', items, ctx).items[0]?.status).toBe('right');
    expect(check(initialQuizState(3), 0, 'are.', items, ctx).items[0]?.status).toBe('right');
    expect(check(initialQuizState(3), 1, 'is  not', items, ctx).items[1]?.status).toBe('right');
  });
  it('item sem accepted nao quebra e shownAnswer vazio', () => {
    expect(() => check(initialQuizState(3), 2, 'x', items, ctx)).not.toThrow();
    expect(shownAnswer(items[2] ?? { accepted: [] })).toBe('');
  });
  it('alternar certo -> errado -> vazio, sem vazar correctAnswer', () => {
    let s = check(initialQuizState(3), 0, 'are', items, ctx);
    s = check(s, 0, 'xyz', items, ctx);
    expect(s.items[0]).toEqual({ status: 'wrong', correctAnswer: 'are' });
    s = check(s, 0, 'are', items, ctx);
    expect(s.items[0]).toEqual({ status: 'right' });
    s = check(s, 0, '', items, ctx);
    expect(s.items[0]).toEqual({ status: 'empty' });
  });
  it('checkAll com menos valores que lacunas e mais valores', () => {
    const s = checkAll(initialQuizState(3), ['are'], items, ctx);
    expect(s.items.map((i) => i.status)).toEqual(['right', 'empty', 'empty']);
    expect(checkAll(initialQuizState(1), ['are', 'x', 'y'], items, ctx).items).toHaveLength(1);
  });
  it('nao muta o estado anterior; toggleAnswers preserva itens', () => {
    const s0 = initialQuizState(3);
    check(s0, 0, 'are', items, ctx);
    expect(s0.items[0]?.status).toBe('empty');
    const t = toggleAnswers(check(s0, 0, 'are', items, ctx));
    expect(t.showAnswers).toBe(true);
    expect(t.items[0]?.status).toBe('right');
  });
});

describe('QA etapa 3: parseMapFilters hostil', () => {
  const p = (s: string) => parseMapFilters(new URLSearchParams(s));
  it('repetidos: usa o primeiro, sem erro', () => {
    expect(p('nivel=A2&nivel=A1').level).toBe('A2');
  });
  it('desconhecidos e maiusculas sao ignorados', () => {
    expect(p('nivel=a1&tipo=GRAMATICA&estudado=SIM&foo=1')).toEqual({ q: '' });
    expect(p('nivel=Z9&tipo=x&estudado=talvez')).toEqual({ q: '' });
  });
  it('q gigante e unicode nao quebram; filterMaps tambem', () => {
    const big = 'a'.repeat(200_000);
    const f = p(`q=${big}`);
    expect(f.q).toHaveLength(200_000);
    const maps = [{ id: 'm', level: 'A1', kind: 'gramatica', search: 'cafe quente' }];
    expect(
      filterMaps(maps, p('q=' + encodeURIComponent('CAFÉ ☕ 日本 \u0000')), new Set()),
    ).toEqual([]);
    expect(filterMaps(maps, p('q=' + encodeURIComponent('Café')), new Set())).toHaveLength(1);
    expect(filterMaps(maps, p('q=%20%20'), new Set())).toHaveLength(1);
  });
  it('unidade com espacos e aparada; so espacos some; ida e volta estavel', () => {
    expect(p('unidade=%20u1%20').unitId).toBe('u1');
    expect(p('unidade=%20%20').unitId).toBeUndefined();
    const f = p('nivel=A1&tipo=vocabulario&estudado=nao&unidade=u1&q=oi');
    expect(parseMapFilters(toSearchParams(f))).toEqual(f);
  });
  it('options restringem valores inexistentes', () => {
    const opts = { levels: ['A1'], unitIds: ['u1'], kinds: ['gramatica'] };
    expect(
      parseMapFilters(new URLSearchParams('nivel=A2&unidade=u9&tipo=vocabulario'), opts),
    ).toEqual({ q: '' });
  });
  it('chaves de prototipo na URL nao poluem', () => {
    const f = p('__proto__=x&constructor=y&nivel=A1');
    expect(f).toEqual({ q: '', level: 'A1' });
  });
});

describe('QA etapa 3: toFlashcard', () => {
  it('item minimo: so campos obrigatorios, sem chaves undefined', () => {
    const c = toFlashcard({ id: 'a', en: 'hi', pt: 'oi' });
    expect(c).toEqual({ itemId: 'a', source: 'unit', front: { en: 'hi' }, back: { pt: 'oi' } });
    expect('example' in c.back || 'pronunciation' in c.back || 'caution' in c.back).toBe(false);
  });
  it('falso cognato com notes vazias/espacos nao gera caution', () => {
    const c = toFlashcard({
      id: 'a',
      en: 'actually',
      pt: 'na verdade',
      focus: 'falso-cognato',
      notes: '   ',
    });
    expect(c.back.caution).toBeUndefined();
  });
  it('notes sem focus falso-cognato nao vira caution; emoji vazio omitido', () => {
    const c = toFlashcard({ id: 'a', en: 'x', pt: ['a', 'b'], notes: 'n', emoji: '' });
    expect(c.back.caution).toBeUndefined();
    expect(c.front.emoji).toBeUndefined();
    expect(c.back.pt).toBe('a, b');
  });
  it('pt como array vazio e padrao no en', () => {
    const c = toFlashcard({ id: 'a', en: "(I'm) [a|b]", pt: [] });
    expect(c.back.pt).toBe('');
    expect(c.front.en).not.toMatch(/[[\]()|]/);
  });
});
