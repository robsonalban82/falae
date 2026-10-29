import { repository } from '../../data';
import { exportFileName } from '../../data/exportImport';
import { clock } from '../../services/clock';
import { downloadJson } from '../../services/backup';

/** Downloads the whole progress; resolves with the file name. */
export async function exportProgress(): Promise<string> {
  const file = await repository.exportAll();
  const name = exportFileName(clock.today());
  downloadJson(name, file);
  return name;
}
