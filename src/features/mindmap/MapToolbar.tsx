import { t } from '../../i18n/pt-BR';
import { Button } from '../../ui/Button';

type Props = { allOpen: boolean; onToggleAll: () => void };

/** Map actions. Hide-English, quick test and practice shortcuts plug in here in later steps. */
export function MapToolbar({ allOpen, onToggleAll }: Props) {
  return (
    <div role="group" aria-label={t.maps.viewer.toolbarLabel} className="flex flex-wrap gap-3">
      <Button variant="ghost" onClick={onToggleAll}>
        {allOpen ? t.maps.viewer.closeAll : t.maps.viewer.openAll}
      </Button>
    </div>
  );
}
