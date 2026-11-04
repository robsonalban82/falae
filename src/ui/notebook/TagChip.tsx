import type { MapTag } from '../../content/schemas/mindmap';
import { t } from '../../i18n/pt-BR';
import { NotebookIcon } from './NotebookIcon';
import { tagIcons } from './notebookIconShapes';
import './notebook.css';

/** Card tag: distinct outline shape + icon + text label, so it works without color. */
export function TagChip({ tag }: { tag: MapTag }) {
  return (
    <span className={`nb-tag nb-tag-${tag}`} data-tag={tag}>
      <NotebookIcon name={tagIcons[tag]} size={15} />
      <span>{t.maps.tags[tag]}</span>
    </span>
  );
}
