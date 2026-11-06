import { useCallback, useEffect, useId, useRef, useState, type Ref } from 'react';
import { loadKnownWords } from '../../content/loader';
import type { MapQuiz } from '../../content/schemas/mindmap';
import {
  check,
  checkAll,
  initialQuizState,
  score,
  toggleAnswers,
  type QuizState,
} from '../../domain/mindmap/quiz';
import { t } from '../../i18n/pt-BR';
import { Button } from '../../ui/Button';
import { QuickTestItem } from './QuickTestItem';
import { CheckIcon } from '../../ui/icons';
import { EyeIcon, PencilIcon } from './viewerIcons';

type Props = {
  quiz: MapQuiz;
  /** The English of the map is already hidden: the tip is not offered. */
  hideOn: boolean;
  onHideEnglish: () => void;
  /** The heading, so the toolbar can move focus to it. */
  headingRef: Ref<HTMLHeadingElement>;
};

const q = t.maps.viewer.quiz;
type Announcement = { text: string; en?: string; n: number };
const NO_WORDS: ReadonlySet<string> = new Set();

/** "Teste rápido": checks blanks with the lesson grader. Persists nothing: no XP, no SRS (§4.4). */
export function QuickTest({ quiz, hideOn, onHideEnglish, headingRef }: Props) {
  const { items } = quiz;
  const titleId = useId();
  const [state, setState] = useState<QuizState>(() => initialQuizState(items.length));
  const [values, setValues] = useState<string[]>(() => items.map(() => ''));
  const [started, setStarted] = useState(false);
  const [announce, setAnnounce] = useState<Announcement | null>(null);
  const [knownWords, setKnownWords] = useState<ReadonlySet<string>>(NO_WORDS);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const checkAllRef = useRef<HTMLButtonElement>(null);
  const valuesRef = useRef(values);
  const lastFocused = useRef(0);
  const live = useRef(true);
  const wordsState = useRef<'idle' | 'loading' | 'done'>('idle');
  const nonce = useRef(0);

  // Lazy: only the typo tolerance depends on it, so a slow load never blocks typing.
  // A failed load is retried on the next check; once it arrives, the marks already given are redone.
  const loadWords = useCallback(() => {
    if (wordsState.current !== 'idle') return;
    wordsState.current = 'loading';
    loadKnownWords().then(
      (words) => {
        wordsState.current = 'done';
        if (!live.current) return;
        setKnownWords(words);
        setState((s) =>
          s.items.reduce(
            (acc, it, i) =>
              it.status === 'empty'
                ? acc
                : check(acc, i, valuesRef.current[i] ?? '', items, { knownWords: words }),
            s,
          ),
        );
      },
      () => {
        wordsState.current = 'idle'; // without it "almost" just becomes "wrong"
      },
    );
  }, [items]);

  useEffect(() => {
    live.current = true;
    loadWords();
    return () => {
      live.current = false;
    };
  }, [loadWords]);

  const ctx = { knownWords };

  // A new key remounts the text, so an identical result is announced again.
  const say = (text: string, en?: string) => setAnnounce({ text, en, n: ++nonce.current });

  const edit = (i: number, value: string) => {
    const next = valuesRef.current.map((x, j) => (j === i ? value : x));
    valuesRef.current = next;
    setValues(next);
    // A stale mark would describe text that is gone.
    setState((s) => (s.items[i]?.status === 'empty' ? s : check(s, i, '', items, ctx)));
    setAnnounce(null);
  };

  const checkOne = (i: number) => {
    loadWords();
    const next = check(state, i, values[i] ?? '', items, ctx);
    setState(next);
    const it = next.items[i];
    const status = it?.status ?? 'empty';
    const text =
      status === 'right'
        ? q.right
        : status === 'almost'
          ? q.almost
          : status === 'wrong'
            ? q.wrong
            : q.empty;
    say(`${q.blank(i + 1)}: ${text}`, status === 'almost' ? it?.correctAnswer : undefined);
  };

  const checkEvery = () => {
    loadWords();
    const next = checkAll(state, values, items, ctx);
    setState(next);
    const s = score(next);
    say(q.score(s.right, s.total));
    const firstWrong = next.items.findIndex((it) => it.status === 'wrong');
    if (firstWrong >= 0) inputs.current[firstWrong]?.focus();
  };

  // Enter checks the blank and moves on: the next one, or "Conferir tudo" after the last.
  const enter = (i: number) => {
    checkOne(i);
    (inputs.current[i + 1] ?? checkAllRef.current)?.focus();
  };

  // The tip button disappears: keep focus on the blank the person was typing in.
  const hideEnglish = () => {
    onHideEnglish();
    inputs.current[lastFocused.current]?.focus();
  };

  return (
    <section aria-labelledby={titleId} className="nb-paper space-y-3 p-4">
      <h2
        id={titleId}
        ref={headingRef}
        tabIndex={-1}
        className="flex scroll-mt-20 items-center gap-2 font-display text-2xl font-semibold"
      >
        <PencilIcon size={24} />
        {t.maps.viewer.hide.quickTest}
      </h2>
      <p className="text-ink-muted">{quiz.instruction}</p>
      <ol className="list-decimal pl-6 marker:font-bold">
        {items.map((item, i) => (
          <QuickTestItem
            key={i}
            index={i}
            isLast={i === items.length - 1}
            prompt={item.prompt}
            hintPt={item.hintPt}
            accepted={item.accepted}
            value={values[i] ?? ''}
            state={state.items[i] ?? { status: 'empty' }}
            showAnswer={state.showAnswers}
            inputRef={(el) => {
              inputs.current[i] = el;
            }}
            onChange={(v) => edit(i, v)}
            onCheck={() => checkOne(i)}
            onEnter={() => enter(i)}
            onFocus={() => {
              lastFocused.current = i;
              setStarted(true);
            }}
          />
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Button ref={checkAllRef} compact onClick={checkEvery}>
          <CheckIcon size={20} />
          {q.checkAll}
        </Button>
        <Button
          variant="ghost"
          compact
          aria-pressed={state.showAnswers}
          onClick={() => setState(toggleAnswers)}
        >
          {state.showAnswers ? q.hide : q.show}
        </Button>
        {started && !hideOn && (
          <Button variant="ghost" compact onClick={hideEnglish}>
            <EyeIcon size={20} />
            {q.tip}
          </Button>
        )}
      </div>
      <p role="status" aria-live="polite" className="min-h-6 font-bold">
        {announce && (
          <span key={announce.n}>
            {announce.text}
            {announce.en && (
              <>
                {' '}
                <span lang="en">{announce.en}</span>
              </>
            )}
          </span>
        )}
      </p>
    </section>
  );
}
