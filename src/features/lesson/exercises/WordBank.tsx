import { useMemo, useState } from 'react';
import { tokenizeForBank } from '../../../content/schema';
import { t } from '../../../i18n/pt-BR';
import { seededShuffle } from '../../../lib/shuffle';
import type { ExerciseProps } from './types';

type Tile = { id: number; word: string };

export function WordBank({ exercise, disabled, onChange }: ExerciseProps<'word-bank'>) {
  const tiles = useMemo<Tile[]>(
    () =>
      seededShuffle(
        [...tokenizeForBank(exercise.answer), ...exercise.distractors],
        exercise.id,
      ).map((word, id) => ({
        id,
        word,
      })),
    [exercise],
  );
  const [picked, setPicked] = useState<number[]>([]);

  const update = (next: number[]) => {
    setPicked(next);
    const value = next.map((id) => tiles[id]?.word ?? '').join(' ');
    onChange(next.length ? { kind: 'text', value } : null);
  };

  const tileClass =
    'min-h-12 rounded-xl border-2 border-line-strong bg-surface px-4 py-2 text-lg font-bold shadow-[0_3px_0_var(--line)] transition-transform duration-100 active:scale-95 disabled:opacity-50';

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">{t.lesson.instructions['word-bank']}</h2>
      <p className="rounded-2xl bg-surface-2 p-4 text-xl">{exercise.promptPt}</p>

      <div
        aria-label={t.lesson.wordBankAnswer}
        role="group"
        className="flex min-h-28 flex-wrap content-start gap-2 border-b-2 border-line-strong pb-3"
      >
        {picked.length === 0 && (
          <p className="self-center text-ink-muted">{t.lesson.wordBankEmpty}</p>
        )}
        {picked.map((id) => {
          const tile = tiles[id];
          if (!tile) return null;
          return (
            <button
              key={id}
              type="button"
              lang="en"
              disabled={disabled}
              aria-label={t.lesson.removeWord(tile.word)}
              onClick={() => update(picked.filter((p) => p !== id))}
              className={tileClass}
            >
              {tile.word}
            </button>
          );
        })}
      </div>

      <div
        role="group"
        aria-label={t.lesson.wordBankBank}
        className="flex flex-wrap justify-center gap-2"
      >
        {tiles.map((tile) => {
          const used = picked.includes(tile.id);
          return (
            <button
              key={tile.id}
              type="button"
              lang="en"
              disabled={disabled || used}
              aria-label={t.lesson.addWord(tile.word)}
              onClick={() => update([...picked, tile.id])}
              className={`${tileClass} ${used ? 'invisible' : ''}`}
            >
              {tile.word}
            </button>
          );
        })}
      </div>
    </div>
  );
}
