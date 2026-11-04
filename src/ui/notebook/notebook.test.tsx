import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mapIcons, mapTags } from '../../content/schemas/mindmap';
import { t } from '../../i18n/pt-BR';
import { MapsIcon } from '../icons';
import { NotebookIcon } from './NotebookIcon';
import { iconShapes, type NotebookIconName } from './notebookIconShapes';
import { TagChip } from './TagChip';

describe('NotebookIcon', () => {
  const all = Object.keys(iconShapes) as NotebookIconName[]; // keys of the typed record
  it('covers every map icon', () => {
    expect(all).toEqual(expect.arrayContaining([...mapIcons]));
  });
  it.each(all)('renders %s as a hidden svg with drawn shapes', (name) => {
    const { container } = render(<NotebookIcon name={name} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg?.querySelectorAll('path').length).toBeGreaterThan(0);
  });
});

describe('TagChip', () => {
  it.each(mapTags)('renders %s with its label as text and a hidden icon', (tag) => {
    const { container } = render(<TagChip tag={tag} />);
    expect(screen.getByText(t.maps.tags[tag])).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('MapsIcon', () => {
  it('renders hidden, filled or not', () => {
    const { container } = render(
      <>
        <MapsIcon />
        <MapsIcon filled />
      </>,
    );
    const svgs = container.querySelectorAll('svg');
    expect(svgs).toHaveLength(2);
    svgs.forEach((s) => expect(s).toHaveAttribute('aria-hidden', 'true'));
  });
});
