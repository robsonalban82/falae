import { act, render, screen } from '@testing-library/react';
import { emitDbOutdated, resetDbOutdated } from '../data/events';
import { t } from '../i18n/pt-BR';
import { UpdateNotice } from './UpdateNotice';

afterEach(() => resetDbOutdated());

it('shows nothing until the DB needs attention', () => {
  render(<UpdateNotice />);
  expect(screen.queryByRole('alert')).toBeNull();
});

it.each([
  ['updated', t.updateNotice.updated, true],
  ['deleted', t.updateNotice.deleted, true],
  ['blocked', t.updateNotice.blocked, false],
] as const)(
  '%s: own text; reload button only when the connection was closed',
  (reason, text, reload) => {
    render(<UpdateNotice />);
    act(() => emitDbOutdated(reason));
    expect(screen.getByRole('alert')).toHaveTextContent(text);
    expect(screen.queryByRole('button', { name: t.updateNotice.reload }) !== null).toBe(reload);
  },
);
