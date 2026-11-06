import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { defaultProfile } from '../../data/models';
import { clock } from '../../services/clock';
import { useProfile } from '../../stores/useProfile';
import { useProgress } from '../../stores/useProgress';
import { useSettings } from '../../stores/useSettings';
import { buildMapPracticeSession, mapPracticeLessonId } from '../../stores/usePractice';
import { clearSession, loadSession, saveSession } from '../lesson/sessionStore';
import { MapPracticeSession } from './MapPracticeSession';

HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
  this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
  this.removeAttribute('open');
};

vi.mock('../../services/speech', () => ({
  ttsSupported: () => false,
  sttSupported: () => false,
  hasNoVoice: () => false,
  subscribeNoVoice: () => () => {},
  speak: () => Promise.resolve(),
  stopSpeaking: () => {},
}));

function renderAt(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/mapas/${id}/praticar`]}>
      <Routes>
        <Route path="/mapas/:mapId/praticar" element={<MapPracticeSession />} />
        <Route path="/mapas" element={<p>maps list</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  clock.setNow('2026-10-29T12:00:00');
  clearSession();
  useProfile.setState({ profile: defaultProfile(clock.iso()), loaded: true });
  useSettings.setState({ loaded: true });
  useProgress.setState({ loaded: true });
});
afterEach(() => clock.reset());

describe('MapPracticeSession', () => {
  it('redirects an unknown map to /mapas', async () => {
    renderAt('nope');
    expect(await screen.findByText('maps list')).toBeInTheDocument();
  });

  it('starts a session for a known map and saves it under map-practice:<mapId>', async () => {
    renderAt('mm-to-be');
    await waitFor(() => expect(screen.queryByText('maps list')).not.toBeInTheDocument());
    await waitFor(() =>
      expect(loadSession(mapPracticeLessonId('mm-to-be'))?.context).toEqual({ mapId: 'mm-to-be' }),
    );
  });

  it('resumes the saved session (same exercises) instead of building a new one', async () => {
    const saved = await buildMapPracticeSession('mm-to-be', {
      tts: false,
      stt: false,
      speakDisabled: true,
    });
    if (!saved) throw new Error('no session');
    saveSession(saved);
    // A rebuilt session would take the new time as startedAt (and seed).
    clock.setNow('2026-10-29T12:05:00');
    renderAt('mm-to-be');
    await screen.findByRole('button', { name: /Verificar|Continuar/ });
    expect(loadSession(saved.lessonId)?.startedAt).toBe(saved.startedAt);
    expect(screen.queryByText('maps list')).not.toBeInTheDocument();
  });

  it('rebuilds instead of resuming a saved run without this map as context', async () => {
    const saved = await buildMapPracticeSession('mm-to-be', {
      tts: false,
      stt: false,
      speakDisabled: true,
    });
    if (!saved) throw new Error('no session');
    saveSession({ ...saved, context: undefined });
    clock.setNow('2026-10-29T12:05:00');
    renderAt('mm-to-be');
    await waitFor(() =>
      expect(loadSession(saved.lessonId)?.context).toEqual({ mapId: 'mm-to-be' }),
    );
    expect(loadSession(saved.lessonId)?.startedAt).not.toBe(saved.startedAt);
  });
});
