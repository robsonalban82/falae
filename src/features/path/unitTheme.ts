import type { Unit } from '../../content/schema';

/** Token classes per unit color (literal strings so Tailwind can see them). */
export const unitTheme: Record<
  Unit['color'],
  { band: string; node: string; ring: string; text: string }
> = {
  manga: {
    band: 'bg-primary text-on-primary',
    node: 'bg-primary text-on-primary border-primary-shade',
    ring: 'bg-primary',
    text: 'text-primary-shade dark:text-primary',
  },
  anil: {
    band: 'bg-secondary text-on-secondary',
    node: 'bg-secondary text-on-secondary border-secondary-shade',
    ring: 'bg-secondary',
    text: 'text-secondary',
  },
  folha: {
    band: 'bg-success text-on-success',
    node: 'bg-success text-on-success border-success-shade',
    ring: 'bg-success',
    text: 'text-success',
  },
  acerola: {
    band: 'bg-danger text-on-danger',
    node: 'bg-danger text-on-danger border-danger-shade',
    ring: 'bg-danger',
    text: 'text-danger',
  },
};

/** Winding path: fixed horizontal pattern, ~36 px steps on phones and ~56 px on desktop. */
const OFFSETS = [0, 1, 2, 1, 0, -1, -2, -1] as const;
const OFFSET_CLASS: Record<(typeof OFFSETS)[number], string> = {
  0: '',
  1: 'translate-x-9 lg:translate-x-14',
  2: 'translate-x-18 lg:translate-x-28',
  [-1]: '-translate-x-9 lg:-translate-x-14',
  [-2]: '-translate-x-18 lg:-translate-x-28',
};

export function windingOffset(index: number): string {
  return OFFSET_CLASS[OFFSETS[index % OFFSETS.length] ?? 0];
}
