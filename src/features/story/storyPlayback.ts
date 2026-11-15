/** Playback state of the animated story (pure; the screen owns the timer). */
export type Playback = { index: number; playing: boolean; ended: boolean };

export type PlaybackAction =
  { type: 'toggle' } | { type: 'next' } | { type: 'prev' } | { type: 'tick' } | { type: 'restart' };

export const initialPlayback: Playback = { index: 0, playing: false, ended: false };

/** `tick` is the automatic advance: on the last scene it stops and marks the story as ended. */
export function playbackReducer(state: Playback, action: PlaybackAction, total: number): Playback {
  const last = Math.max(0, total - 1);
  switch (action.type) {
    case 'toggle':
      // Play after the end starts over.
      if (state.ended) return { index: 0, playing: true, ended: false };
      return { ...state, playing: !state.playing };
    case 'next':
      if (state.index >= last) return state;
      return { ...state, index: state.index + 1, ended: false };
    case 'prev':
      if (state.index <= 0) return state;
      return { ...state, index: state.index - 1, ended: false };
    case 'tick':
      if (!state.playing) return state;
      if (state.index >= last) return { index: last, playing: false, ended: true };
      return { ...state, index: state.index + 1 };
    case 'restart':
      return { index: 0, playing: true, ended: false };
  }
}
