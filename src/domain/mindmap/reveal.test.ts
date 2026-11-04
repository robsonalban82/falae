import { fixtureLookup, fixtureMap } from './testFixture';
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

const chunks = hideableChunks(fixtureMap, fixtureLookup);
const reveal = (s: RevealState, key: string) => revealIn(s, key, chunks);
const rate = (s: RevealState, key: string, r: RevealRating) => rateIn(s, key, r, chunks);
const on = () => toggleReveal(initialRevealState());

describe('hideableChunks', () => {
  it('covers item, text and fix.right in JSON order; skips notes and missing refs', () => {
    expect(chunks.map((c) => [c.key, c.kind, c.text])).toEqual([
      ['b0.n0.l0', 'item', "I'm fine"],
      ['b0.n0.l1', 'text', 'you are'],
      ['b0.n1.l0', 'item', 'happy'],
      ['b0.n1.l1', 'item', "I'm fine"],
      ['b1.n0.l0', 'fix', 'Yes, I am.'],
    ]);
    expect(chunks[0]?.itemId).toBe('u1-im');
    expect(chunks[1]).not.toHaveProperty('itemId');
  });
});

describe('reveal state', () => {
  it('only reveals when on, once per key; rating needs a revealed chunk', () => {
    expect(reveal(initialRevealState(), 'b0.n0.l0').revealed).toEqual([]);
    const s = reveal(reveal(on(), 'b0.n0.l0'), 'b0.n0.l0');
    expect(s.revealed).toEqual(['b0.n0.l0']);
    expect(rate(on(), 'b0.n0.l0', 'forgot').ratings).toEqual({});
    expect(rate(s, 'b0.n0.l0', 'forgot').ratings).toEqual({ 'b0.n0.l0': 'forgot' });
  });

  it('turning the mode off zeroes the state; reset keeps it on', () => {
    const s = rate(reveal(on(), 'b0.n0.l0'), 'b0.n0.l0', 'remembered');
    expect(toggleReveal(s)).toEqual(initialRevealState());
    expect(resetReveal(s)).toEqual({ on: true, revealed: [], ratings: {} });
  });

  it('isComplete needs the mode on and every chunk revealed', () => {
    const all = chunks.reduce((s, c) => reveal(s, c.key), on());
    expect(isComplete(all, chunks)).toBe(true);
    expect(isComplete({ ...all, on: false }, chunks)).toBe(false);
    expect(isComplete(reveal(on(), 'b0.n0.l0'), chunks)).toBe(false);
  });
});

describe('revealOutcomes', () => {
  it('maps remembered to 4 and forgot to 1; unrated lines do not appear', () => {
    let s = reveal(reveal(on(), 'b0.n0.l0'), 'b0.n1.l0');
    s = rate(s, 'b0.n1.l0', 'remembered');
    expect(revealOutcomes(s, chunks)).toEqual([{ itemId: 'xa-happy', q: 4 }]);
  });

  it('the same item on two lines keeps the lowest q', () => {
    let s = chunks.reduce((acc, c) => reveal(acc, c.key), on());
    s = rate(rate(s, 'b0.n0.l0', 'remembered'), 'b0.n1.l1', 'forgot');
    expect(revealOutcomes(s, chunks)).toEqual([{ itemId: 'u1-im', q: 1 }]);
    s = rate(s, 'b0.n1.l1', 'remembered');
    expect(revealOutcomes(s, chunks)).toEqual([{ itemId: 'u1-im', q: 4 }]);
  });

  it('ignores ratings on chunks without an item', () => {
    let s = reveal(on(), 'b0.n0.l1');
    s = rate(s, 'b0.n0.l1', 'forgot');
    expect(revealOutcomes(s, chunks)).toEqual([]);
  });
});

describe('mapStudySummary', () => {
  it('no ratings: accuracy 1, no outcomes, 5 xp, not perfect', () => {
    const s = chunks.reduce((acc, c) => reveal(acc, c.key), on());
    expect(mapStudySummary(s, chunks, 1000, 4000)).toEqual({
      xp: 5,
      accuracy: 1,
      perfect: false,
      mistakes: 0,
      durationMs: 3000,
      itemOutcomes: [],
    });
  });

  it('accuracy is remembered over rated lines; mistakes are the forgot', () => {
    let s = chunks.reduce((acc, c) => reveal(acc, c.key), on());
    s = rate(rate(s, 'b0.n0.l0', 'remembered'), 'b0.n1.l0', 'forgot');
    const summary = mapStudySummary(s, chunks, 5000, 1000);
    expect(summary.accuracy).toBe(0.5);
    expect(summary.mistakes).toBe(1);
    expect(summary.durationMs).toBe(0);
    expect(summary.itemOutcomes).toEqual([
      { itemId: 'u1-im', q: 4 },
      { itemId: 'xa-happy', q: 1 },
    ]);
  });
});
