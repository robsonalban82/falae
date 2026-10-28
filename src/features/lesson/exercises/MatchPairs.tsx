import { useMemo, useState } from 'react';
import { t } from '../../../i18n/pt-BR';
import { seededShuffle } from '../../../lib/shuffle';
import type { ExerciseProps } from './types';

type Side = 'en' | 'pt';

export function MatchPairs({
  exercise,
  disabled,
  onChange,
  onSubmit,
}: ExerciseProps<'match-pairs'>) {
  const left = useMemo(
    () =>
      seededShuffle(
        exercise.pairs.map((p, i) => ({ i, text: p.en })),
        `${exercise.id}-en`,
      ),
    [exercise],
  );
  const right = useMemo(
    () =>
      seededShuffle(
        exercise.pairs.map((p, i) => ({ i, text: p.pt })),
        `${exercise.id}-pt`,
      ),
    [exercise],
  );
  const [matched, setMatched] = useState<number[]>([]);
  const [selected, setSelected] = useState<{ side: Side; i: number } | null>(null);
  const [wrong, setWrong] = useState<{ en: number; pt: number } | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [message, setMessage] = useState('');

  const pick = (side: Side, i: number) => {
    setWrong(null);
    if (!selected || selected.side === side) {
      setSelected({ side, i });
      return;
    }
    const en = side === 'en' ? i : selected.i;
    const pt = side === 'pt' ? i : selected.i;
    setSelected(null);
    if (en === pt) {
      const next = [...matched, en];
      setMatched(next);
      const done = next.length === exercise.pairs.length;
      setMessage(
        done ? t.lesson.pairsDone : t.lesson.pairsMatched(next.length, exercise.pairs.length),
      );
      if (done) {
        const response = { kind: 'pairs', mistakes } as const;
        onChange(response);
        // Nothing left to decide: check right away (focus would otherwise sit on a disabled tile).
        onSubmit(response);
      }
    } else {
      setMistakes((m) => m + 1);
      setWrong({ en, pt });
      setMessage(t.lesson.pairsWrong);
    }
  };

  const cell = (side: Side, item: { i: number; text: string }) => {
    const isMatched = matched.includes(item.i);
    const isSelected = selected?.side === side && selected.i === item.i;
    const isWrong = wrong !== null && wrong[side] === item.i;
    return (
      <button
        key={`${side}-${item.i}`}
        type="button"
        lang={side === 'en' ? 'en' : 'pt-BR'}
        disabled={disabled || isMatched}
        aria-pressed={isSelected}
        onClick={() => pick(side, item.i)}
        className={[
          'min-h-14 w-full rounded-2xl border-2 px-3 py-2 text-lg font-bold transition-colors duration-100',
          isMatched
            ? 'border-success bg-success-soft text-success'
            : isWrong
              ? 'border-danger bg-danger-soft text-danger'
              : isSelected
                ? 'border-secondary bg-surface-2 text-secondary'
                : 'border-line-strong bg-surface',
        ].join(' ')}
      >
        {isMatched && <span aria-hidden="true">✓ </span>}
        {item.text}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">{t.lesson.instructions['match-pairs']}</h2>
      <div className="grid grid-cols-2 gap-3">
        <div role="group" aria-label={t.lesson.pairsEnglish} className="space-y-3">
          {left.map((item) => cell('en', item))}
        </div>
        <div role="group" aria-label={t.lesson.pairsPortuguese} className="space-y-3">
          {right.map((item) => cell('pt', item))}
        </div>
      </div>
      <p aria-live="polite" className="min-h-6 text-center text-ink-muted">
        {message}
      </p>
    </div>
  );
}
