import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import backupV1 from '../../test/fixtures/backup-v1.json';
import { repository } from '../../data';
import { t } from '../../i18n/pt-BR';
import { BackupSection } from './BackupSection';

HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
  this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
  this.removeAttribute('open');
};

const NOW = '2026-10-29T12:00:00.000Z';
const card = {
  id: 'uc-abcdefgh',
  en: 'good morning',
  pt: 'bom dia',
  createdAt: NOW,
  updatedAt: NOW,
};

async function pickBackup() {
  const file = new File([JSON.stringify(backupV1)], 'backup.json', { type: 'application/json' });
  await userEvent.upload(screen.getByLabelText(t.settings.import), file);
}

beforeEach(async () => {
  await repository.resetAll();
});
afterEach(() => vi.restoreAllMocks());

describe('BackupSection: warning about the student cards', () => {
  it('warns (inside the dialog description) when the db has cards and the file has none', async () => {
    await repository.saveUserCard(card);
    render(<BackupSection />);
    await pickBackup();
    const warning = await screen.findByText(t.settings.importDropsCards);
    const dialog = warning.closest('dialog');
    const describedBy = dialog?.getAttribute('aria-describedby');
    expect(describedBy && dialog?.querySelector(`#${CSS.escape(describedBy)}`)).toContainElement(
      warning,
    );
  });

  it('does not warn when the db has no cards', async () => {
    render(<BackupSection />);
    await pickBackup();
    await waitFor(() => expect(screen.getByText(t.settings.importTitle)).toBeInTheDocument());
    expect(screen.queryByText(t.settings.importDropsCards)).toBeNull();
  });

  it('warns when the card count fails (unknown counts as "may have cards")', async () => {
    vi.spyOn(repository, 'countUserCards').mockRejectedValue(new Error('idb down'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<BackupSection />);
    await pickBackup();
    expect(await screen.findByText(t.settings.importDropsCards)).toBeInTheDocument();
  });
});
