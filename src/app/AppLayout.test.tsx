import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { repository } from '../data';
import { defaultProfile, defaultSettings } from '../data/models';
import { clock } from '../services/clock';
import { useProfile } from '../stores/useProfile';
import { useProgress } from '../stores/useProgress';
import { useSettings } from '../stores/useSettings';
import { AppLayout } from './AppLayout';
import { act } from 'react';

function renderAt(path: string, handle?: unknown) {
  const router = createMemoryRouter(
    [
      {
        element: <AppLayout />,
        children: [{ path: '*', element: <p>conteudo</p>, handle }],
      },
    ],
    { initialEntries: [path] },
  );
  return render(<RouterProvider router={router} />);
}

afterEach(() => clock.reset());

describe('AppLayout navigation', () => {
  it('has 5 items in order', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Navegação principal' });
    expect(
      within(nav)
        .getAllByRole('link')
        .map((a) => a.textContent),
    ).toEqual(['Trilha', 'Mapas', 'Praticar', 'Perfil', 'Ajustes']);
  });

  it('keeps Maps active on nested map routes, and only there', () => {
    renderAt('/mapas/mm-to-be');
    expect(screen.getByRole('link', { name: 'Mapas' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Trilha' })).not.toHaveAttribute('aria-current');
  });

  it('hides the bottom bar on phones when the route asks (kept for desktop)', () => {
    renderAt('/mapas/x', { hideBottomNav: true, wide: true });
    expect(screen.getByRole('navigation')).toHaveClass('hidden', 'lg:block');
    expect(screen.getByRole('main')).toHaveClass('max-w-3xl');
  });

  it('changes nothing without a handle', () => {
    renderAt('/perfil');
    expect(screen.getByRole('navigation')).not.toHaveClass('hidden');
    expect(screen.getByRole('main')).toHaveClass('max-w-2xl');
  });

  it('shows the stats bar only when the route asks', async () => {
    clock.setNow('2026-10-29T12:00:00');
    await repository.resetAll();
    useProfile.setState({ profile: defaultProfile(clock.iso()), loaded: false });
    useProgress.setState({ loaded: false, progress: [], xpToday: 0 });
    useSettings.setState({ settings: defaultSettings(), loaded: true });
    const { unmount } = renderAt('/mapas', { statsBar: true });
    expect(await screen.findByRole('img', { name: 'Meta diária: 0 de 20 XP' })).toBeInTheDocument();
    unmount();
    renderAt('/config');
    expect(screen.queryByRole('img', { name: /Meta diária/ })).not.toBeInTheDocument();
  });

  it('publishes the bar height once late settings arrive', async () => {
    clock.setNow('2026-10-29T12:00:00');
    useProfile.setState({ profile: defaultProfile(clock.iso()), loaded: true });
    useProgress.setState({ loaded: true, progress: [], xpToday: 0 });
    useSettings.setState({ settings: defaultSettings(), loaded: false });
    const root = document.documentElement.style;
    root.removeProperty('--path-header-h');
    renderAt('/', { statsBar: true });
    expect(root.getPropertyValue('--path-header-h')).toBe('');
    act(() => useSettings.setState({ loaded: true }));
    expect(await screen.findByRole('img', { name: /Meta diária/ })).toBeInTheDocument();
    expect(root.getPropertyValue('--path-header-h')).not.toBe('');
  });
});
