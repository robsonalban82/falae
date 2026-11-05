import type { BranchColor, MapNode } from '../../content/schemas/mindmap';
import { lineView, type ItemLookup } from '../../domain/mindmap/lines';
import { parseBold, stripBold } from '../../domain/mindmap/richText';
import { TagChip } from '../../ui/notebook/TagChip';
import { branchStyles } from './branchStyles';
import { MapLine } from './MapLine';
import { MapScene } from './MapScene';
import { RichText } from './RichText';

type Props = {
  node: MapNode;
  color: BranchColor;
  lookup: ItemLookup;
  onDetails: (itemId: string, trigger: HTMLElement) => void;
};

/** One card: tag chip on the corner, optional title, lines, and the scene at the bottom right. */
export function MapCard({ node, color, lookup, onDetails }: Props) {
  const style = branchStyles[color];
  const views = node.lines.flatMap((line) => lineView(line, node.tag, lookup) ?? []);
  // A title that only repeats the first English line adds nothing (common in vocabulary cards).
  const first = views[0];
  const firstEn = first?.kind === 'item' ? first.en : first?.kind === 'text' ? first.speakText : '';
  const dup =
    node.title !== undefined &&
    stripBold(node.title).trim().toLowerCase() === firstEn.trim().toLowerCase();
  return (
    <li className={`relative mt-4 rounded-md border-2 ${style.card}`}>
      <div className="absolute -top-3.5 left-2.5 z-10">
        <TagChip tag={node.tag} />
      </div>
      <div className="flex items-end gap-3 px-3.5 pt-5 pb-3.5">
        <div className="min-w-0 flex-1 space-y-1">
          {node.title && !dup && (
            <p className="font-bold text-ink-muted">
              <RichText segments={parseBold(node.title).segments} boldClassName={style.key} />
            </p>
          )}
          <ul className="space-y-1">
            {views.map((view, i) => (
              <MapLine key={i} view={view} keyClass={style.key} onDetails={onDetails} />
            ))}
          </ul>
        </div>
        <MapScene name={node.art} size="card" />
      </div>
    </li>
  );
}
