import { useEffect, useRef, useState, type ReactNode } from 'react';
import { t } from '../../i18n/pt-BR';
import { speak } from '../../services/speech';
import { SpeakerIcon } from './viewerIcons';
import { useCanSpeak } from './useCanSpeak';

type Props = {
  /** What is spoken (plain text, no markup). */
  text: string;
  /** What is shown (the English snippet; wrapped in lang="en" here). */
  children: ReactNode;
  className?: string;
};

/**
 * An English snippet that speaks when tapped. Without speech (or without a voice) it is plain
 * text: the map shows one notice at the end instead of a dead button.
 */
export function SpeakText({ text, children, className = '' }: Props) {
  const canSpeak = useCanSpeak();
  const [speaking, setSpeaking] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  if (!canSpeak) {
    return (
      <span lang="en" className={className}>
        {children}
      </span>
    );
  }

  const play = () => {
    setSpeaking(true);
    // A newer speak() settles this one too, so the state never sticks.
    speak(text).then(
      () => alive.current && setSpeaking(false),
      () => alive.current && setSpeaking(false),
    );
  };

  return (
    <button
      type="button"
      aria-pressed={speaking}
      onClick={play}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-left align-middle focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus ${className}`}
    >
      <span className="sr-only">{t.maps.viewer.listen} </span>
      <span lang="en">{children}</span>
      <SpeakerIcon className={speaking ? 'shrink-0 text-secondary' : 'shrink-0 text-ink-muted'} />
      {speaking && <span className="sr-only">{t.maps.viewer.speaking}</span>}
    </button>
  );
}
