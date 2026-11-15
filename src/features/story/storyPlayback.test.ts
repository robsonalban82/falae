import { initialPlayback, playbackReducer, type Playback } from './storyPlayback';

const TOTAL = 3;
const run = (state: Playback, ...types: Parameters<typeof playbackReducer>[1]['type'][]) =>
  types.reduce((s, type) => playbackReducer(s, { type }, TOTAL), state);

describe('playbackReducer', () => {
  it('starts paused on the first scene', () => {
    expect(initialPlayback).toEqual({ index: 0, playing: false, ended: false });
  });

  it('toggles play and pause without moving', () => {
    const playing = run(initialPlayback, 'toggle');
    expect(playing).toEqual({ index: 0, playing: true, ended: false });
    expect(run(playing, 'toggle')).toEqual(initialPlayback);
  });

  it('ignores ticks while paused', () => {
    expect(run(initialPlayback, 'tick')).toEqual(initialPlayback);
  });

  it('advances on tick and ends on the last scene', () => {
    const state = run(initialPlayback, 'toggle', 'tick', 'tick');
    expect(state).toEqual({ index: 2, playing: true, ended: false });
    expect(run(state, 'tick')).toEqual({ index: 2, playing: false, ended: true });
  });

  it('clamps next and prev to the scene range', () => {
    expect(run(initialPlayback, 'prev')).toEqual(initialPlayback);
    expect(run(initialPlayback, 'next', 'next', 'next', 'next').index).toBe(2);
  });

  it('keeps the playing flag when stepping by hand', () => {
    expect(run(initialPlayback, 'toggle', 'next')).toEqual({
      index: 1,
      playing: true,
      ended: false,
    });
  });

  it('clears the end mark when going back, and replays from the start on toggle', () => {
    const ended = run(initialPlayback, 'toggle', 'tick', 'tick', 'tick');
    expect(run(ended, 'prev')).toEqual({ index: 1, playing: false, ended: false });
    expect(run(ended, 'toggle')).toEqual({ index: 0, playing: true, ended: false });
    expect(run(ended, 'restart')).toEqual({ index: 0, playing: true, ended: false });
  });
});
