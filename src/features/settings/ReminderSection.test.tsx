import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../../data/models';
import { useSettings } from '../../stores/useSettings';
import { ReminderSection } from './ReminderSection';

vi.mock('../../services/notifications', () => ({
  currentPermission: () => 'granted',
  requestPermission: () => Promise.resolve('granted'),
}));

const update = vi.fn(() => Promise.resolve());

function setReminder(enabled: boolean, time: string) {
  const settings = defaultSettings();
  useSettings.setState({ settings: { ...settings, reminder: { enabled, time } }, update });
}

describe('ReminderSection time picker', () => {
  beforeEach(() => update.mockClear());

  it('shows 24-hour selects in a labeled group and saves HH:MM', async () => {
    setReminder(true, '19:30');
    render(<ReminderSection />);
    const hour = screen.getByLabelText('Hora');
    const minute = screen.getByLabelText('Minutos');
    expect(screen.getByRole('group', { name: 'Horário do lembrete' })).toBeInTheDocument();
    expect(hour).toHaveValue('19');
    expect(minute).toHaveValue('30');
    expect(screen.getAllByRole('option', { name: '23' })).toHaveLength(1);
    await userEvent.selectOptions(hour, '07');
    expect(update).toHaveBeenLastCalledWith({ reminder: { enabled: true, time: '07:30' } });
    await userEvent.selectOptions(minute, '05');
    expect(update).toHaveBeenLastCalledWith({ reminder: { enabled: true, time: '19:05' } });
  });

  it('keeps an off-grid saved minute selectable', () => {
    setReminder(true, '08:07');
    render(<ReminderSection />);
    expect(screen.getByLabelText('Minutos')).toHaveValue('07');
  });

  it('disables both selects while the reminder is off', () => {
    setReminder(false, '19:00');
    render(<ReminderSection />);
    expect(screen.getByLabelText('Hora')).toBeDisabled();
    expect(screen.getByLabelText('Minutos')).toBeDisabled();
  });
});
