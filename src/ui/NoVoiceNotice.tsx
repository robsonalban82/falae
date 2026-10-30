import { useSyncExternalStore } from 'react';
import { t } from '../i18n/pt-BR';
import { hasNoVoice, subscribeNoVoice } from '../services/speech';

/** Explains silent audio once speech failed to start for lack of an English voice. */
export function NoVoiceNotice() {
  const noVoice = useSyncExternalStore(subscribeNoVoice, hasNoVoice);
  return (
    <p role="status" className={noVoice ? 'text-sm text-ink-muted' : 'sr-only'}>
      {noVoice ? t.lesson.noVoice : ''}
    </p>
  );
}
