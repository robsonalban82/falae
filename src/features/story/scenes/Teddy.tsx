import { c } from '../palette';

/** Plush teddy bear sitting (origin at its base). */
export function Teddy({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke={c.outline} strokeWidth="1.2">
      <ellipse cx="0" cy="-9" rx="9" ry="9" fill={c.teddy} />
      <circle cx="-7" cy="-27" r="3.5" fill={c.teddyShade} />
      <circle cx="7" cy="-27" r="3.5" fill={c.teddyShade} />
      <circle cx="0" cy="-21" r="8" fill={c.teddy} />
      <ellipse cx="0" cy="-18.5" rx="3.4" ry="2.6" fill={c.wall} />
      <g fill={c.outline} stroke="none">
        <circle cx="-3" cy="-23" r="1" />
        <circle cx="3" cy="-23" r="1" />
        <circle cx="0" cy="-19.5" r="1" />
      </g>
    </g>
  );
}
