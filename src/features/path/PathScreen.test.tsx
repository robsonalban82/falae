import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { repository } from '../../data';
import { defaultProfile, defaultSettings } from '../../data/models';
import { clock } from '../../services/clock';
import { useProfile } from '../../stores/useProfile';
import { useProgress } from '../../stores/useProgress';
import { useSettings } from '../../stores/useSettings';
import { PathScreen } from './PathScreen';
import { StatsBar } from './StatsBar';

function renderPath(state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/', state }]}>
      {/* The app layout puts the stats bar above the path. */}
      <StatsBar />
      <PathScreen />
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  clock.setNow('2026-10-29T12:00:00');
  await repository.resetAll();
  useProfile.setState({ profile: defaultProfile(clock.iso()), loaded: false });
  useProgress.setState({ loaded: false, progress: [], xpToday: 0 });
  useSettings.setState({ settings: defaultSettings(), loaded: true });
});
afterEach(() => clock.reset());

describe('PathScreen', () => {
  it('new user: first skill open (first lesson current), the rest locked (focusable buttons)', async () => {
    renderPath();
    const current = await screen.findByRole('link', { name: /^Lição 1 de 3, .*, atual$/ });
    expect(current).toHaveAttribute('href', '/licao/u1-sk1-l1');
    expect(screen.getByRole('link', { name: /^Lição 2 de 3, / })).toHaveAttribute(
      'href',
      '/licao/u1-sk1-l2',
    );
    const locked = screen.getAllByRole('button', { name: /bloqueada/ });
    expect(locked.length).toBeGreaterThan(5);
    locked.forEach((b) => expect(b).toHaveAttribute('aria-disabled', 'true'));
    expect(
      screen.getByRole('button', {
        name: 'Revisão da unidade 1, bloqueada — conquiste as 4 coroas',
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('region').length).toBeGreaterThanOrEqual(4);
    expect(screen.getByRole('img', { name: 'Meta diária: 0 de 20 XP' })).toBeInTheDocument();
  });

  it('pressing a locked node explains why', async () => {
    renderPath();
    const user = userEvent.setup();
    const [first] = await screen.findAllByRole('button', { name: /^Lição 2 de 3.*bloqueada/ });
    if (!first) throw new Error('no locked lesson');
    await user.click(first);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Conclua todas as lições da habilidade anterior para abrir esta.',
    );
  });

  it('shows the redirect notice', async () => {
    renderPath({ notice: 'lessonLocked' });
    expect(await screen.findByRole('status')).toHaveTextContent('bloqueada');
  });

  it('completed lessons and progress come from the repository', async () => {
    await repository.importAll({
      ...(await repository.exportAll()),
      data: {
        ...(await repository.exportAll()).data,
        lessonProgress: [
          {
            lessonId: 'u1-sk1-l1',
            completedCount: 1,
            bestAccuracy: 1,
            firstCompletedAt: clock.iso(),
          },
        ],
        daily: [{ day: '2026-10-29', xp: 12, lessons: 1, goalMet: false }],
      },
    });
    renderPath();
    expect(
      await screen.findByRole('link', { name: /^Lição 1 de 3, .*, concluída$/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Lição 2 de 3, .*, atual$/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Meta diária: 12 de 20 XP' })).toBeInTheDocument();
  });
});
