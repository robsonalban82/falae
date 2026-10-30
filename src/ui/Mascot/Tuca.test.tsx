import { act, render, screen } from '@testing-library/react';
import { t } from '../../i18n/pt-BR';
import { Tuca } from './Tuca';

vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>();
  return { ...actual, useReducedMotion: () => true };
});

async function settle(ms = 50) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

describe('Tuca', () => {
  it('shows one image per mood with an accessible name', () => {
    const { rerender } = render(<Tuca mood="happy" />);
    const happySrc = screen.getByRole('img').getAttribute('src');
    expect(screen.getByRole('img', { name: t.mascot.moods.happy })).toBeInTheDocument();

    rerender(<Tuca mood="sad" />);
    expect(screen.getByRole('img', { name: t.mascot.moods.sad })).toBeInTheDocument();
    expect(screen.getByRole('img').getAttribute('src')).not.toBe(happySrc);
  });

  it('decorative mascots are hidden from screen readers', () => {
    const { container } = render(<Tuca decorative />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
  });

  it('with reduced motion holds the first keyframe (no loop)', async () => {
    const { container } = render(<Tuca mood="celebrating" />);
    await settle();
    const first = container.querySelector('img')?.style.transform;
    await settle(500);
    expect(container.querySelector('img')?.style.transform).toBe(first);
  });
});
