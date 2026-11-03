import { act, render, screen } from '@testing-library/react';
import { emitDbOutdated, resetDbOutdated } from '../data/events';
import { t } from '../i18n/pt-BR';
import { UpdateNotice } from './UpdateNotice';

afterEach(() => resetDbOutdated());

it('shows nothing until the DB is outdated, then an alert with a reload button', () => {
  render(<UpdateNotice />);
  expect(screen.queryByRole('alert')).toBeNull();
  act(() => emitDbOutdated());
  expect(screen.getByRole('alert')).toHaveTextContent(t.updateNotice.text);
  expect(screen.getByRole('button', { name: t.updateNotice.reload })).toBeInTheDocument();
});
