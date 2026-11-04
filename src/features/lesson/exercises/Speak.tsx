import { useEffect, useMemo, useRef, useState } from 'react';
import { t } from '../../../i18n/pt-BR';
import { matchSpokenWords } from '../../../domain/grading/spokenWords';
import { noteSpeakTurn, startRecording, type Recording } from '../../../services/recorder';
import { listen, stopSpeaking, ttsSupported, type Listening } from '../../../services/speech';
import { Button } from '../../../ui/Button';
import { En } from '../../../ui/En';
import { SpeakerButton } from './SpeakerButton';
import type { ExerciseProps } from './types';
import { NoVoiceNotice } from '../../../ui/NoVoiceNotice';

type Phase = 'idle' | 'listening' | 'heard' | 'nothing' | 'denied';

export function Speak({ exercise, disabled, onChange, onSkip }: ExerciseProps<'speak'>) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [heard, setHeard] = useState('');
  const heardWords = useMemo(
    () => matchSpokenWords(exercise.textEn, heard),
    [exercise.textEn, heard],
  );
  const session = useRef<Listening | null>(null);
  // The learner's own voice for this turn (memory only, never saved).
  const recording = useRef<Promise<Recording> | null>(null);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const [playingVoice, setPlayingVoice] = useState(false);

  useEffect(
    () => () => {
      const s = session.current;
      session.current = null; // ignore the abort's rejection after unmount
      s?.abort();
      void recording.current?.then((r) => r.cancel());
      player.current?.pause();
    },
    [],
  );

  useEffect(
    () => () => {
      if (voiceUrl) URL.revokeObjectURL(voiceUrl);
    },
    [voiceUrl],
  );

  const keepVoice = (s: Listening, rec: Promise<Recording>, heardSomething: boolean) => {
    void rec
      .then((r) => {
        noteSpeakTurn(heardSomething, r.active);
        return r.stop();
      })
      .then((blob) => {
        if (session.current === s && blob) setVoiceUrl(URL.createObjectURL(blob));
      });
  };

  const stopVoice = () => {
    player.current?.pause();
    player.current = null;
    setPlayingVoice(false);
  };

  const playVoice = () => {
    if (!voiceUrl) return;
    if (playingVoice) return stopVoice();
    stopSpeaking();
    player.current?.pause();
    const audio = new Audio(voiceUrl);
    player.current = audio;
    audio.onended = () => {
      if (player.current === audio) stopVoice();
    };
    setPlayingVoice(true);
    audio.play().catch(() => {
      if (player.current === audio) stopVoice();
    });
  };

  const start = () => {
    // Tapping while listening ends the turn with what was heard (iOS may never end on its own).
    if (phase === 'listening') {
      session.current?.stop();
      return;
    }
    session.current?.abort();
    void recording.current?.then((r) => r.cancel());
    stopVoice();
    setVoiceUrl(null);
    setPhase('listening');
    const s = listen();
    session.current = s;
    const rec = startRecording();
    recording.current = rec;
    s.result
      .then((transcripts) => {
        if (session.current !== s) return;
        keepVoice(s, rec, transcripts.length > 0);
        if (transcripts.length === 0) {
          setPhase('nothing');
          onChange(null);
          return;
        }
        // Show the alternative closest to the sentence (recognizers often rank it second).
        const score = (x: string) =>
          matchSpokenWords(exercise.textEn, x).filter((w) => w.heard).length;
        setHeard(transcripts.reduce((best, x) => (score(x) > score(best) ? x : best)));
        setPhase('heard');
        onChange({ kind: 'speech', transcripts });
      })
      .catch((err: Error) => {
        if (session.current !== s) return;
        keepVoice(s, rec, false);
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
      {/* The model voice and the learner's own recording never play together. */}
      <div
        className="flex items-center gap-3 rounded-2xl bg-surface-2 p-4"
        onClickCapture={() => {
          if (player.current) stopVoice();
        }}
      >
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
        {phase === 'heard' && (
          <div className="text-center">
            <p className="text-xl leading-relaxed">
              <En>
                {heardWords.map((w, i) => (
                  <span key={i}>
                    {i > 0 && ' '}
                    {w.heard ? (
                      <span className="font-bold text-success">{w.text}</span>
                    ) : (
                      <mark className="rounded bg-danger-soft px-0.5 font-bold text-danger underline decoration-wavy">
                        {w.text}
                        <span lang="pt-BR" className="sr-only">
                          {' '}
                          ({t.lesson.speakWordMissed})
                        </span>
                      </mark>
                    )}
                  </span>
                ))}
              </En>
            </p>
            <p className="mt-1 text-sm text-ink-muted">{t.lesson.speakWordsLegend}</p>
          </div>
        )}
        {voiceUrl && phase !== 'listening' && (
          // Stays enabled after checking: hearing yourself is the point.
          <Button variant="ghost" onClick={playVoice} aria-pressed={playingVoice}>
            {playingVoice ? t.lesson.speakStopMine : t.lesson.speakPlayMine}
          </Button>
        )}
      </div>

      {!disabled && (
        <Button variant="ghost" block onClick={onSkip}>
          {t.lesson.cantSpeakNow}
        </Button>
      )}
    </div>
  );
}
