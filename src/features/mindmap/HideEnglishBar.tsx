import { t } from '../../i18n/pt-BR';
import { Button } from '../../ui/Button';
import { Tuca } from '../../ui/Mascot/Tuca';
import { EyeIcon } from './viewerIcons';

type Props = {
  on: boolean;
  revealed: number;
  total: number;
  onToggle: () => void;
};

/** "Esconder o inglês" toggle plus its hint and live progress (lives inside the map toolbar). */
export function HideEnglishBar({ on, revealed, total, onToggle }: Props) {
  const h = t.maps.viewer.hide;
  const progress = revealed >= total ? h.allRevealed : h.progress(revealed, total);
  return (
    <>
      <Button
        compact
        variant={on ? 'secondary' : 'ghost'}
        aria-pressed={on}
        onClick={onToggle}
        disabled={total === 0}
      >
        <EyeIcon size={20} />
        {h.toggle}
      </Button>
      <div className={`flex basis-full items-center gap-3 ${on ? '' : 'sr-only'}`}>
        {on && <Tuca mood="thinking" size={48} decorative />}
        {/* Always mounted so turning the mode on and each reveal are announced. Once everything is
            revealed it goes quiet: the end panel announces the result instead. */}
        <p
          role="status"
          aria-live={revealed >= total && total > 0 ? 'off' : 'polite'}
          className="min-w-0 flex-1 text-ink-muted"
        >
          {on && (
            <>
              {revealed === 0 && <span className="block">{h.hint}</span>}
              <span className="block font-bold text-ink">{progress}</span>
            </>
          )}
        </p>
      </div>
    </>
  );
}
