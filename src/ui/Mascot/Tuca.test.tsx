import { act, render } from '@testing-library/react';
import { Tuca } from './Tuca';

vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>();
  return { ...actual, useReducedMotion: () => true };
});

const wing = (container: HTMLElement) =>
  container.querySelector<SVGPathElement>('path[d^="M78 98"]');

async function settle(ms = 50) {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

describe('Tuca with reduced motion', () => {
  it('switches wing poses instantly and keeps the final pose (no tween, no loop)', async () => {
    const { container, rerender } = render(<Tuca mood="happy" />);
    await settle();
    expect(wing(container)?.style.transform).toMatch(/none|^$|rotate\(0deg\)/);

    rerender(<Tuca mood="thinking" />);
    await settle();
    expect(wing(container)?.style.transform).toContain('rotate(-100deg)');

    // Celebrating loops between keyframes normally; reduced motion holds the first one.
    rerender(<Tuca mood="celebrating" />);
    await settle();
    const first = wing(container)?.style.transform;
    expect(first).toContain('rotate(-150deg)');
    await settle(500);
    expect(wing(container)?.style.transform).toBe(first);
  });
});
