import { buildExercises } from '../../test/fixtures/buildUnit';
import { applyFallbacks } from './fallbacks';

const exercises = buildExercises('l', 'item-a', 'item-b');
const lookup = (id: string) =>
  id === 'item-a' ? { en: 'hello', pt: ['olá'], acceptedPt: ['oi'] } : undefined;
const all = { tts: true, stt: true, speakDisabled: false };

describe('applyFallbacks', () => {
  it('keeps everything when the browser supports it', () => {
    expect(applyFallbacks(exercises, all, lookup)).toEqual(exercises);
  });

  it('drops speak exercises without STT or when disabled', () => {
    const types = (caps: typeof all) => applyFallbacks(exercises, caps, lookup).map((e) => e.type);
    expect(types({ ...all, stt: false })).not.toContain('speak');
    expect(types({ ...all, speakDisabled: true })).not.toContain('speak');
  });

  it('turns listen-type into a translation of the same item without TTS', () => {
    const out = applyFallbacks(exercises, { ...all, tts: false }, lookup);
    expect(out.map((e) => e.type)).not.toContain('listen-type');
    const fb = out.find((e) => e.id === 'l-e4-fallback');
    expect(fb).toMatchObject({
      type: 'translate-typing',
      promptEn: 'Hello!',
      accepted: ['olá', 'oi'],
    });
  });

  it('drops listen-type when the heard text is not the item itself (answers would not fit)', () => {
    const other = (id: string) => (id === 'item-a' ? { en: 'hello', pt: ['olá'] } : undefined);
    const ex = [
      { id: 'x', type: 'listen-type' as const, itemIds: ['item-a'], textEn: 'Hello, Ana!' },
    ];
    expect(applyFallbacks(ex, { ...all, tts: false }, other)).toEqual([]);
  });

  it('drops listen-type when the item cannot be found', () => {
    const out = applyFallbacks(exercises, { ...all, tts: false }, () => undefined);
    expect(out.some((e) => e.id.startsWith('l-e4'))).toBe(false);
  });
});
