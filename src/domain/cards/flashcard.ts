import { displayPattern } from '../grading/patterns';
import { joinSenses, type MapItemShape } from '../items';

export type Formality = 'informal' | 'neutro' | 'giria';
export type FlashcardSource = 'unit' | 'bank' | 'user';

/** Item fields a card needs (unit vocab/sentences and bank items fit). */
export type FlashcardItemShape = MapItemShape & {
  example?: { en: string; pt: string };
  emoji?: string;
  pronunciation?: string;
  focus?: string;
  notes?: string;
};

/** How a collection presents the item (optional annotations). */
export type FlashcardEntryShape = {
  situation?: string;
  formality?: Formality;
  avoidWhen?: string;
};

/** Derived view of an item (MAPAS-E-CARTAS §2.6). Not `Card`: that name is the SRS card. */
export type Flashcard = {
  itemId: string;
  source: FlashcardSource;
  front: { en: string; emoji?: string };
  back: {
    pt: string;
    example?: { en: string; pt: string };
    pronunciation?: string;
    caution?: string;
    situation?: string;
    formality?: Formality;
    avoidWhen?: string;
  };
  level?: string;
};

export const FALSE_FRIEND_FOCUS = 'falso-cognato';

export function toFlashcard(
  item: FlashcardItemShape,
  entry?: FlashcardEntryShape,
  meta: { source?: FlashcardSource; level?: string } = {},
): Flashcard {
  const caution = item.focus === FALSE_FRIEND_FOCUS ? item.notes?.trim() : undefined;
  return {
    itemId: item.id,
    source: meta.source ?? 'unit',
    front: {
      en: displayPattern(item.en),
      ...(item.emoji ? { emoji: item.emoji } : {}),
    },
    back: {
      pt: joinSenses(item.pt),
      ...(item.example ? { example: { en: item.example.en, pt: item.example.pt } } : {}),
      ...(item.pronunciation ? { pronunciation: item.pronunciation } : {}),
      ...(caution ? { caution } : {}),
      ...(entry?.situation ? { situation: entry.situation } : {}),
      ...(entry?.formality ? { formality: entry.formality } : {}),
      ...(entry?.avoidWhen ? { avoidWhen: entry.avoidWhen } : {}),
    },
    ...(meta.level ? { level: meta.level } : {}),
  };
}
