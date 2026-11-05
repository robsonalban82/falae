import type { BranchColor } from '../../content/schemas/mindmap';

/** Full class names per branch color (Tailwind only generates classes it can read as literals). */
export const branchStyles: Record<
  BranchColor,
  { ribbon: string; panel: string; card: string; key: string }
> = {
  folha: {
    ribbon: 'bg-map-folha-fill text-map-folha-on',
    panel: 'border-map-folha-stroke',
    card: 'border-map-folha-stroke bg-map-folha-tint',
    key: 'text-map-folha-key',
  },
  jabuticaba: {
    ribbon: 'bg-map-jabuticaba-fill text-map-jabuticaba-on',
    panel: 'border-map-jabuticaba-stroke',
    card: 'border-map-jabuticaba-stroke bg-map-jabuticaba-tint',
    key: 'text-map-jabuticaba-key',
  },
  anil: {
    ribbon: 'bg-map-anil-fill text-map-anil-on',
    panel: 'border-map-anil-stroke',
    card: 'border-map-anil-stroke bg-map-anil-tint',
    key: 'text-map-anil-key',
  },
  manga: {
    ribbon: 'bg-map-manga-fill text-map-manga-on',
    panel: 'border-map-manga-stroke',
    card: 'border-map-manga-stroke bg-map-manga-tint',
    key: 'text-map-manga-key',
  },
  acerola: {
    ribbon: 'bg-map-acerola-fill text-map-acerola-on',
    panel: 'border-map-acerola-stroke',
    card: 'border-map-acerola-stroke bg-map-acerola-tint',
    key: 'text-map-acerola-key',
  },
  maracuja: {
    ribbon: 'bg-map-maracuja-fill text-map-maracuja-on',
    panel: 'border-map-maracuja-stroke',
    card: 'border-map-maracuja-stroke bg-map-maracuja-tint',
    key: 'text-map-maracuja-key',
  },
};
