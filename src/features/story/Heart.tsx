import { c } from './palette';

/** Small heart (origin at its center, about 12 units wide). */
export function Heart({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${scale})`}
      d="M0 5 Q-7 0 -5.5 -3.5 Q-3 -6.5 0 -3 Q3 -6.5 5.5 -3.5 Q7 0 0 5 Z"
      fill={c.heart}
      stroke={c.outline}
      strokeWidth="1"
      strokeLinejoin="round"
    />
  );
}
