import type { ReactNode } from 'react';
import { t } from '../../i18n/pt-BR';
import { Button } from '../../ui/Button';

type Props = { allOpen: boolean; onToggleAll: () => void; children?: ReactNode };

/** Map actions: open/close all, then the hide-English bar (quick test plugs in later). */
export function MapToolbar({ allOpen, onToggleAll, children }: Props) {
  return (
    <div
      role="group"
      aria-label={t.maps.viewer.toolbarLabel}
      className="flex flex-wrap gap-2 sm:gap-3"
    >
      <Button variant="ghost" compact onClick={onToggleAll}>
        {allOpen ? t.maps.viewer.closeAll : t.maps.viewer.openAll}
      </Button>
      {children}
    </div>
  );
}
