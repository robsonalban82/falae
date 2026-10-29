import { startLesson } from '../../domain/lesson/engine';
import type { Exercise } from '../../content/schema';
import {
  clearHeartsPending,
  clearSession,
  loadSession,
  markHeartsPending,
  readHeartsPending,
  saveSession,
} from './sessionStore';

const exercise: Exercise = {
  id: 'x1',
  type: 'multiple-choice',
  itemIds: ['u1-hi'],
  prompt: 'p',
  options: [{ text: 'hi' }, { text: 'bye' }, { text: 'good morning' }],
  answer: 'hi',
};
const state = startLesson({
  lessonId: 'l1',
  kind: 'lesson',
  exercises: [exercise],
  hearts: 5,
  nowMs: 0,
});

afterEach(() => clearSession());

describe('sessionStore heartsSpentPending', () => {
  it('is written synchronously with the session and survives a reload', () => {
    saveSession(state);
    markHeartsPending('l1', 4);
    expect(readHeartsPending('l1')).toBe(4);
    expect(readHeartsPending('other')).toBeNull();
    // still a valid session
    expect(loadSession('l1')).not.toBeNull();
  });

  it('is kept on later saves until every write lands', () => {
    saveSession(state);
    markHeartsPending('l1', 4);
    saveSession({ ...state, turn: 1 });
    expect(readHeartsPending('l1')).toBe(4);
    clearHeartsPending();
    expect(readHeartsPending('l1')).toBeNull();
  });
});
