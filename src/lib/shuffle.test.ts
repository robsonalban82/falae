import { seededShuffle } from './shuffle';

describe('seededShuffle', () => {
  const items = Array.from({ length: 20 }, (_, i) => i);
  it('is deterministic per seed and keeps all items', () => {
    expect(seededShuffle(items, 'a')).toEqual(seededShuffle(items, 'a'));
    expect([...seededShuffle(items, 'a')].sort((x, y) => x - y)).toEqual(items);
  });
  it('different seeds give different orders and input is untouched', () => {
    const copy = [...items];
    expect(seededShuffle(items, 'a')).not.toEqual(seededShuffle(items, 'b'));
    expect(items).toEqual(copy);
  });
});
