import { useEffect, useRef } from 'react';
import { useCanSpeak } from './useCanSpeak';

/**
 * Speech state plus the ref of the single "no voice" notice. Speech buttons turn into plain
 * text when the voice fails: focus moves to the notice instead of falling to <body>.
 */
export function useNoVoiceNotice() {
  const canSpeak = useCanSpeak();
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const wasSpeaking = useRef(canSpeak);

  useEffect(() => {
    const lost = wasSpeaking.current && !canSpeak;
    wasSpeaking.current = canSpeak;
    if (!lost) return;
    const active = document.activeElement;
    if (!active || active === document.body) noticeRef.current?.focus();
  }, [canSpeak]);

  return { canSpeak, noticeRef };
}
