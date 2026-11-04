import type { MapIcon, MapTag } from '../../content/schemas/mindmap';

/** Hand-drawn 24x24 shapes, stroked with currentColor. Own drawings for Falaê. */
export type IconShape = {
  paths: readonly string[];
  /** Small circles: [cx, cy, r, filled]. */
  dots?: readonly (readonly [number, number, number, boolean])[];
};

export type TagIconName = 'ruler' | 'warn' | 'xcircle';
export type NotebookIconName = MapIcon | TagIconName;

export const iconShapes: Record<NotebookIconName, IconShape> = {
  check: { paths: ['M4.6 12.9c1.5 1.3 3 2.9 4.2 4.6 2.7-4.4 5.9-8.1 10.4-11.2'] },
  ban: {
    paths: [
      'M12 3.7c4.7-.2 8.5 3.6 8.4 8.3-.1 4.6-3.8 8.2-8.5 8.1-4.6-.1-8.2-3.8-8.1-8.4.1-4.4 3.7-7.9 8.2-8z',
      'M6.3 6.5c3.9 3.6 7.7 7.4 11.4 11.1',
    ],
  },
  question: {
    paths: [
      'M8.4 9.1c-.2-2.5 1.6-4.4 3.8-4.4 2.2 0 3.9 1.5 3.8 3.5-.1 2.6-3.4 3-3.8 5.7l-.1 1.2',
      'M12.1 19.3v.1',
    ],
  },
  quote: {
    paths: ['M12.6 5.2c2.9-.2 4.5 1.6 4.2 4.3-.3 3.4-2.8 6.3-6.4 8.3'],
    dots: [[11.8, 7.6, 3.1, true]],
  },
  x: { paths: ['M6.1 6.3c4 3.8 8 7.7 11.9 11.6M17.8 6.1c-3.9 4-7.8 8-11.6 11.9'] },
  bulb: {
    paths: [
      'M9.1 17.4h5.9M9.9 20.4h4.3',
      'M12 3.6c-3.4 0-6 2.6-5.9 5.8.1 2.2 1.4 3.4 2.4 4.6.6.8.6 1.6.6 2.6h5.8c0-1 0-1.8.6-2.6 1-1.2 2.4-2.5 2.4-4.6 0-3.3-2.6-5.8-5.9-5.8z',
    ],
  },
  clock: {
    paths: [
      'M12 3.8c4.6-.1 8.3 3.6 8.2 8.2 0 4.5-3.7 8.1-8.3 8.1-4.5-.1-8.1-3.7-8-8.3.1-4.4 3.6-7.9 8.1-8z',
      'M12 7.3v5.1l3.3 2.1',
    ],
  },
  pin: {
    paths: ['M12 20.8c-2.6-3.5-6-7-6-10.8a6 6 0 0 1 12 0c0 3.8-3.4 7.3-6 10.8z'],
    dots: [[12, 10, 2.1, false]],
  },
  book: {
    paths: [
      'M12 6.6C10 5.1 7 4.7 3.9 5.1v13.1c3.1-.4 6.1 0 8.1 1.4 2-1.4 5-1.8 8.1-1.4V5.1c-3.1-.4-6.1 0-8.1 1.5z',
      'M12 6.6v12.9',
    ],
  },
  chat: {
    paths: [
      'M4.5 6.3c0-1.1.8-1.9 1.9-1.9h11.2c1.1 0 1.9.8 1.9 1.9v7.3c0 1.1-.8 1.9-1.9 1.9h-7.4l-4.1 3.6.3-3.6c-1.1 0-1.9-.8-1.9-1.9z',
    ],
  },
  star: {
    paths: ['M12 3.9l2.4 5 5.3.6-3.9 3.7 1.1 5.4L12 15.9l-4.9 2.7 1.1-5.4-3.9-3.7 5.3-.6z'],
  },
  arrow: {
    paths: [
      'M4 12.3c5.2-.4 10.3-.3 15.3 0',
      'M14.3 6.9c1.8 1.9 3.5 3.5 5.3 5.3-1.9 1.7-3.6 3.5-5.2 5.4',
    ],
  },
  calendar: {
    paths: [
      'M4.6 6.4c5-.2 9.9-.1 14.9 0l-.1 13.1c-4.9.1-9.9.1-14.8 0z',
      'M4.7 10.4h14.7M8.5 4v4M15.5 4v4',
    ],
  },
  home: {
    paths: ['M4 11.5 12 4.3l8 7.2', 'M6.4 9.7V20h11.2V9.7', 'M10 20v-5.1h4V20'],
  },
  hash: { paths: ['M9.7 4 8.1 20M16 4l-1.6 16M4.6 9.1h15.3M4.1 15h15.3'] },
  swap: {
    paths: [
      'M5 8.5c4.3-.2 8.6-.1 12.9 0',
      'M14.6 5l3.6 3.5-3.6 3.5',
      'M19 15.6c-4.3.2-8.6.1-12.9 0',
      'M9.4 12.1 5.8 15.6l3.6 3.5',
    ],
  },
  ruler: {
    paths: [
      'M3.6 8.6c5.6-.2 11.2-.1 16.8 0v6.9c-5.6.1-11.2.1-16.8 0z',
      'M7 8.7v3M10.4 8.7v2.1M13.8 8.7v3M17.2 8.7v2.1',
    ],
  },
  warn: { paths: ['M12 4.2 3.6 19.4c5.6.2 11.2.2 16.8 0z', 'M12 10.1v4.3M12 17.1v.1'] },
  xcircle: {
    paths: [
      'M12 3.7c4.7-.2 8.5 3.6 8.4 8.3-.1 4.6-3.8 8.2-8.5 8.1-4.6-.1-8.2-3.8-8.1-8.4.1-4.4 3.7-7.9 8.2-8z',
      'M9 9.1c2 1.9 4 3.9 6 5.9M15 9c-2 2-4 4-5.9 6',
    ],
  },
};

/** Icon drawn inside each tag chip (shape + icon + label). */
export const tagIcons: Record<MapTag, NotebookIconName> = {
  regra: 'ruler',
  exemplo: 'chat',
  excecao: 'warn',
  'erro-comum': 'xcircle',
  vocabulario: 'book',
};
