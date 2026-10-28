import type { Exercise } from '../../content/schema';
import { normalize } from '../grading/normalize';

export type Capabilities = {
  /** speechSynthesis with an English voice */
  tts: boolean;
  /** SpeechRecognition available */
  stt: boolean;
  /** learner chose "Não posso falar agora" recently */
  speakDisabled: boolean;
};

export type ItemLookup = (
  itemId: string,
) => { en: string; pt: string | string[]; acceptedPt?: string[] | undefined } | undefined;

/**
 * Adapts a lesson to the browser (docs/ARQUITETURA.md §9):
 * - no TTS: listen-type becomes an EN→PT translation of the same item (or is dropped);
 * - no STT or speaking disabled: speak exercises are dropped.
 */
export function applyFallbacks(
  exercises: readonly Exercise[],
  caps: Capabilities,
  lookup: ItemLookup,
): Exercise[] {
  const out: Exercise[] = [];
  for (const ex of exercises) {
    if (ex.type === 'speak' && (!caps.stt || caps.speakDisabled)) continue;
    if (ex.type === 'listen-type' && !caps.tts) {
      // Only an item whose English is exactly the heard text has translations that fit the prompt.
      const target = normalize(ex.textEn, 'en');
      const item = ex.itemIds
        .map(lookup)
        .find((it) => it !== undefined && normalize(it.en, 'en') === target);
      if (!item) continue;
      out.push({
        id: `${ex.id}-fallback`,
        type: 'translate-typing',
        itemIds: ex.itemIds,
        promptEn: ex.textEn,
        accepted: [...(Array.isArray(item.pt) ? item.pt : [item.pt]), ...(item.acceptedPt ?? [])],
        ...(ex.explanation ? { explanation: ex.explanation } : {}),
      });
      continue;
    }
    out.push(ex);
  }
  return out;
}
