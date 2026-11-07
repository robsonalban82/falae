import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { RouteError } from './RouteError';

describe('RouteError', () => {
  it('shows the friendly screen when a route throws, without the error message', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const Boom = () => {
      throw new URIError('URI malformed secret-stack');
    };
    const router = createMemoryRouter(
      [{ errorElement: <RouteError />, children: [{ path: '/x', element: <Boom /> }] }],
      { initialEntries: ['/x'] },
    );
    render(<RouterProvider router={router} />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar para a Trilha' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('button', { name: 'Recarregar' })).toBeInTheDocument();
    expect(screen.queryByText(/secret-stack/)).toBeNull();
  });
});
