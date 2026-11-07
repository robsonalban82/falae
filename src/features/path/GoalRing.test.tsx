import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GoalRing } from './GoalRing';

const progress = { xp: 5, goal: 20, ratio: 0.25, met: false };

describe('GoalRing', () => {
  it('has one accessible label by default', () => {
    render(<GoalRing progress={progress} />);
    expect(screen.getAllByRole('img', { name: 'Meta diária: 5 de 20 XP' })).toHaveLength(1);
  });

  it('is hidden from screen readers when decorative', () => {
    render(<GoalRing progress={progress} decorative />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByLabelText(/Meta diária/)).toBeNull();
  });
});
