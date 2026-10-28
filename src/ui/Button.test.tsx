import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';
import { ProgressBar } from './ProgressBar';
import { Tuca } from './Mascot/Tuca';

describe('ui primitives', () => {
  it('Button is a real button and respects disabled', async () => {
    const onClick = vi.fn();
    render(
      <>
        <Button onClick={onClick}>Continuar</Button>
        <Button disabled onClick={onClick}>
          Verificar
        </Button>
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Verificar' }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Continuar' })).toHaveAttribute('type', 'button');
  });

  it('ProgressBar exposes its value and clamps', () => {
    render(<ProgressBar value={12} max={10} label="Progresso" />);
    const bar = screen.getByRole('progressbar', { name: 'Progresso' });
    expect(bar).toHaveAttribute('aria-valuenow', '10');
    expect(bar.firstElementChild).toHaveStyle({ transform: 'scaleX(1)' });
  });

  it('Tuca has an accessible name per mood, or is hidden when decorative', () => {
    const { rerender, container } = render(<Tuca mood="sad" />);
    expect(screen.getByRole('img', { name: /triste/ })).toHaveAttribute('data-mood', 'sad');
    rerender(<Tuca mood="happy" decorative />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});
