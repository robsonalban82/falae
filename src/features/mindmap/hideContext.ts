import { createContext, useContext } from 'react';
import type { RevealRating } from '../../domain/mindmap/reveal';

/** What a covered chunk needs from the map study (provided by MapView). */
export type HideChunks = {
  on: boolean;
  isRevealed: (key: string) => boolean;
  rating: (key: string) => RevealRating | undefined;
  /** Ratings are frozen once the study is being saved. */
  locked: boolean;
  reveal: (key: string) => void;
  rate: (key: string, rating: RevealRating) => void;
};

const off: HideChunks = {
  on: false,
  isRevealed: () => true,
  rating: () => undefined,
  locked: true,
  reveal: () => undefined,
  rate: () => undefined,
};

export const HideContext = createContext<HideChunks>(off);

export const useHideChunks = (): HideChunks => useContext(HideContext);
