afterEach(() => {
  vi.doUnmock('./knownWords.generated');
  vi.resetModules();
});

it('loadKnownWords does not cache a failed chunk load: the next call retries', async () => {
  vi.resetModules();
  let reads = 0;
  // The module is evaluated once, so the first read of `knownWords` yields a non-iterable
  // (new Set(5) throws inside the loader's then) and later reads work: a failed load, then a retry.
  vi.doMock('./knownWords.generated', () => ({
    get knownWords() {
      reads += 1;
      return reads === 1 ? 5 : ['hello'];
    },
  }));
  const { loadKnownWords } = await import('./loader');
  await expect(loadKnownWords()).rejects.toThrow();
  const words = await loadKnownWords();
  expect(words.has('hello')).toBe(true);
});
