import { useEffect, useRef, useState } from 'react';
import { t } from '../../../i18n/pt-BR';
import { listen, ttsSupported, type Listening } from '../../../services/speech';
import { Button } from '../../../ui/Button';
import { En } from '../../../ui/En';
import { SpeakerButton } from './SpeakerButton';
import type { ExerciseProps } from './types';
import { NoVoiceNotice } from '../../../ui/NoVoiceNotice';

type Phase = 'idle' | 'listening' | 'heard' | 'nothing' | 'denied';

export function Speak({ exercise, disabled, onChange, onSkip }: ExerciseProps<'speak'>) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [heard, setHeard] = useState('');
  const session = useRef<Listening | null>(null);

  useEffect(
    () => () => {
      const s = session.current;
      session.current = null; // ignore the abort's rejection after unmount
      s?.abort();
    },
    [],
  );

  const start = () => {
    // Tapping while listening ends the turn with what was heard (iOS may never end on its own).
    if (phase === 'listening') {
      session.current?.stop();
      return;
    }
    session.current?.abort();
    setPhase('listening');
    const s = listen();
    session.current = s;
    s.result
      .then((transcripts) => {
        if (session.current !== s) return;
        if (transcripts.length === 0) {
          setPhase('nothing');
          onChange(null);
          return;
        }
        setHeard(transcripts[0] ?? '');
        setPhase('heard');
        onChange({ kind: 'speech', transcripts });
      })
      .catch((err: Error) => {
        if (session.current !== s) return;
        const denied = err.message === 'not-allowed' || err.message === 'service-not-allowed';
        setPhase(denied ? 'denied' : 'nothing');
        onChange(null);
        // No microphone permission: same as "Não posso falar agora" (speak paused for 1 h).
        if (denied) onSkip();
      });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">{t.lesson.instructions.speak}</h2>
      <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-4">
        {ttsSupported() && (
          <SpeakerButton
            text={exercise.textEn}
            label={t.lesson.listen}
            // the microphone would hear the app's own voice
            disabled={phase === 'listening'}
          />
        )}
        <En className="text-xl font-bold">{exercise.textEn}</En>
      </div>
      {ttsSupported() && <NoVoiceNotice />}

      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={start}
          disabled={disabled}
          aria-pressed={phase === 'listening'}
          aria-label={phase === 'listening' ? t.lesson.speakStop : t.lesson.speakStart}
          className={`flex h-24 w-24 items-center justify-center rounded-full shadow-[0_6px_16px_-6px_rgb(var(--shadow)/0.45)] transition-transform active:scale-95 ${
            phase === 'listening'
              ? 'animate-pulse bg-danger text-on-danger motion-reduce:animate-none'
              : 'bg-primary'
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            width="40"
            height="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </button>
        <p aria-live="polite" className="min-h-6 text-center text-ink-muted">
          {phase === 'idle' && t.lesson.speakStart}
          {phase === 'listening' && t.lesson.speakListening}
          {phase === 'heard' && (
            <>
              {t.lesson.speakHeard} <En className="font-bold text-ink">“{heard}”</En>
            </>
          )}
          {phase === 'nothing' && t.lesson.speakNothing}
          {phase === 'denied' && t.lesson.speakDenied}
        </p>
      </div>

      {!disabled && (
        <Button variant="ghost" block onClick={onSkip}>
          {t.lesson.cantSpeakNow}
        </Button>
      )}
    </div>
  );
}
