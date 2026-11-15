import { c } from './palette';

/** Small tropical fish swimming to the right (origin at its center). */
export function Fish({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-7 0 L-13 -5 L-13 5 Z" fill={color} stroke={c.outline} strokeWidth="1.2" />
      <ellipse rx="8" ry="5" fill={color} stroke={c.outline} strokeWidth="1.2" />
      <circle cx="4" cy="-1" r="1.2" fill={c.outline} />
    </g>
  );
}
