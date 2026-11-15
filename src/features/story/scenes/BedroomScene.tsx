import { Giulia } from '../Giulia';
import { Loop } from '../Loop';
import { c } from '../palette';
import { Zeca } from '../Zeca';
import type { SceneProps } from './sceneProps';
import { Teddy } from './Teddy';

/** Scene 5: Zeca jumps on Giulia's fluffy bed, among the teddy bears. */
export function BedroomScene({ moving }: SceneProps) {
  return (
    <g>
      <rect width="320" height="180" fill={c.wall} />
      <rect y="150" width="320" height="30" fill={c.floor} />
      <rect
        x="22"
        y="22"
        width="70"
        height="60"
        rx="4"
        fill={c.sky}
        stroke={c.wood}
        strokeWidth="4"
      />
      <Loop moving={moving} scale={[1, 1.1, 1]} duration={4}>
        <circle cx="70" cy="42" r="9" fill={c.sun} />
      </Loop>
      <path d="M57 22 V82 M22 52 H92" stroke={c.wood} strokeWidth="3" />
      <path d="M14 18 Q28 50 16 88 H10 V18 Z M100 18 Q86 50 98 88 H104 V18 Z" fill={c.curtain} />
      {/* bed */}
      <rect
        x="286"
        y="78"
        width="14"
        height="80"
        rx="5"
        fill={c.wood}
        stroke={c.outline}
        strokeWidth="1.6"
      />
      <rect
        x="128"
        y="112"
        width="12"
        height="46"
        rx="4"
        fill={c.wood}
        stroke={c.outline}
        strokeWidth="1.6"
      />
      <rect
        x="134"
        y="118"
        width="158"
        height="30"
        rx="8"
        fill={c.bed}
        stroke={c.outline}
        strokeWidth="1.6"
      />
      <path d="M136 138 H290 V142 Q290 148 284 148 H142 Q136 148 136 142 Z" fill={c.bedShade} />
      <rect
        x="250"
        y="104"
        width="38"
        height="18"
        rx="8"
        fill={c.white}
        stroke={c.outline}
        strokeWidth="1.4"
      />
      <Teddy x={232} y={119} />
      <Teddy x={262} y={106} />
      <Loop moving={moving} scale={[1, 0.6, 1]} opacity={[0.5, 0.2, 0.5]} duration={0.9}>
        <ellipse cx="180" cy="122" rx="20" ry="3.5" fill={c.bedShade} />
      </Loop>
      <Loop moving={moving} y={[0, -26, 0]} duration={0.9}>
        <Zeca x={180} y={102} scale={1.05} moving={moving} />
      </Loop>
      <Loop moving={moving} y={[0, -2, 0]} duration={0.6}>
        <Giulia x={74} y={170} scale={1.3} mood="laugh" hand={[16, -40]} />
      </Loop>
    </g>
  );
}
