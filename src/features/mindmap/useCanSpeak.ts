import { useSyncExternalStore } from 'react';
import { hasNoVoice, subscribeNoVoice, ttsSupported } from '../../services/speech';

/** False without speech synthesis or once speech failed to start for lack of an English voice. */
export function useCanSpeak(): boolean {
  const noVoice = useSyncExternalStore(subscribeNoVoice, hasNoVoice);
  return ttsSupported() && !noVoice;
}
