import { useState } from 'react';
import { speak } from '../../../services/speech';

type Props = { text: string; label: string; slow?: boolean; size?: 'lg' | 'sm' };

/** Plays English text with TTS. */
export function SpeakerButton({ text, label, slow = false, size = 'sm' }: Props) {
  const [playing, setPlaying] = useState(false);
  const play = () => {
    setPlaying(true);
    speak(text, { slow })
      .catch(() => {})
      .finally(() => setPlaying(false));
  };
  const dims = size === 'lg' ? 'h-24 w-24' : 'h-12 w-12';
  return (
    <button
      type="button"
      onClick={play}
      aria-label={label}
      aria-pressed={playing}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-secondary text-on-secondary shadow-[0_6px_16px_-6px_rgb(var(--shadow)/0.45)] transition-transform duration-150 active:scale-95 ${dims}`}
    >
      {slow ? (
        <svg
          viewBox="0 0 24 24"
          width={size === 'lg' ? 36 : 22}
          height={size === 'lg' ? 36 : 22}
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M4 15c0-4 3.5-7 8-7s8 3 8 7H4zm3 1h10l-1 2H8l-1-2zm11-5 3-2v3l-2 1-1-2zM9 6a3 3 0 0 1 6 0" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          width={size === 'lg' ? 40 : 22}
          height={size === 'lg' ? 40 : 22}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
          <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
        </svg>
      )}
    </button>
  );
}
