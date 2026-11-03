import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import backupV1 from '../../test/fixtures/backup-v1.json';
import { upgradeExportV1 } from '../../data/exportImport';
import { exportFileV1Schema } from '../../data/models';
import { BackupSection } from './BackupSection';

const mocks = vi.hoisted(() => ({ userCards: 0 }));

vi.mock('../../data', () => ({
  repository: {
    getLessonProgress: () => Promise.resolve([]),
    getAchievements: () => Promise.resolve([]),
    countUserCards: () => Promise.resolve(mocks.userCards),
    importAll: vi.fn(() => Promise.resolve()),
  },
}));

const WARN = 'Este arquivo não tem suas cartas; elas serão apagadas.';
const v2 = upgradeExportV1(exportFileV1Schema.parse(backupV1));
const card = {
  id: 'uc-abcdefgh',
  en: 'good morning',
  pt: 'bom dia',
  createdAt: v2.exportedAt,
  updatedAt: v2.exportedAt,
};

async function pick(body: unknown) {
  const file = new File([JSON.stringify(body)], 'x.json', { type: 'application/json' });
  await userEvent.upload(screen.getByLabelText('Importar progresso'), file);
  await screen.findByRole('dialog');
}

describe('BackupSection cards warning', () => {
  beforeEach(() => {
    // jsdom has no <dialog> modal API
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute('open');
    };
    mocks.userCards = 0;
  });

  it('shows when the bank has cards and the file has none (v1 and v2)', async () => {
    mocks.userCards = 3;
    render(<BackupSection />);
    await pick(backupV1);
    expect(screen.getByText(WARN)).toBeInTheDocument();
  });

  it('shows for a v2 file with no cards', async () => {
    mocks.userCards = 1;
    render(<BackupSection />);
    await pick(v2);
    expect(screen.getByText(WARN)).toBeInTheDocument();
  });

  it('hidden when the bank has no cards', async () => {
    render(<BackupSection />);
    await pick(backupV1);
    expect(screen.queryByText(WARN)).not.toBeInTheDocument();
  });

  it('hidden when the file has cards too', async () => {
    mocks.userCards = 3;
    render(<BackupSection />);
    await pick({ ...v2, data: { ...v2.data, userCards: [card] } });
    expect(screen.queryByText(WARN)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
  });
});
