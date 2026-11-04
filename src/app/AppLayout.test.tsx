import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppLayout } from './AppLayout';

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
});
