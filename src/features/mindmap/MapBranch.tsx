import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useId } from 'react';
import type { MapBranch as Branch } from '../../content/schemas/mindmap';
import type { ItemLookup } from '../../domain/mindmap/lines';
import { t } from '../../i18n/pt-BR';
import { NotebookIcon } from '../../ui/notebook/NotebookIcon';
import { branchStyles } from './branchStyles';
import { MapCard } from './MapCard';
import { ChevronIcon } from './viewerIcons';

type Props = {
  branch: Branch;
  /** Position in the map (chunk keys start with `b{index}`). */
  index: number;
  open: boolean;
  onToggle: () => void;
  lookup: ItemLookup;
  onDetails: (itemId: string, trigger: HTMLElement) => void;
};

/** Collapsible branch: a colored ribbon button (h2) over the panel of cards. */
export function MapBranch({ branch, index, open, onToggle, lookup, onDetails }: Props) {
  const reduce = useReducedMotion();
  const panelId = useId();
  const style = branchStyles[branch.color];
  const count = branch.nodes.length;
  const cards = (
    <ul
      id={panelId}
      className={`ml-1.5 grid items-start gap-x-5 border-l-4 pt-1 pb-1 pl-4 ${style.panel} ${count > 1 ? 'lg:grid-cols-2' : ''}`}
    >
      {branch.nodes.map((node, i) => (
        <MapCard
          key={i}
          node={node}
          keyPrefix={`b${index}.n${i}`}
          color={branch.color}
          lookup={lookup}
          onDetails={onDetails}
        />
      ))}
    </ul>
  );
  return (
    <li>
      <section>
        <h2>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            onClick={onToggle}
            className={`flex min-h-12 w-full items-center gap-2.5 rounded-xl px-4 py-1.5 text-left font-display text-xl font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus ${style.ribbon}`}
          >
            <ChevronIcon className={open ? '' : '-rotate-90'} />
            <NotebookIcon name={branch.icon} size={24} />
            <span className="min-w-0 flex-1">{branch.label}</span>
            <span className="rounded-full border-2 border-ink bg-paper-card px-2.5 text-base font-bold text-ink">
              <span aria-hidden="true">{count}</span>
              <span className="sr-only">, {t.maps.cards(count)}</span>
            </span>
          </button>
        </h2>
        {/* Reduced motion: plain show/hide. Otherwise a short height/opacity transition. */}
        {reduce ? (
          open && cards
        ) : (
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                key="panel"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                {cards}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </section>
    </li>
  );
}
