import { BeachBackdrop } from '../BeachBackdrop';
import { Giulia } from '../Giulia';
import { Heart } from '../Heart';
import { Loop } from '../Loop';
import { c } from '../palette';
import { Zeca } from '../Zeca';
import type { SceneProps } from './sceneProps';

/** Scene 3: after the pinch, Giulia forgives Zeca and offers a piece of fruit. */
export function BeachSorryScene({ moving }: SceneProps) {
  return (
    <g>
      <BeachBackdrop moving={moving} />
      <Giulia x={112} y={156} scale={1.35} pose="sit" mood="kind" hand={[23, -22]} />
      <path
        d="M156 160 Q168 140 180 160 Z"
        fill={c.fruit}
        stroke={c.outline}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M162 158 Q168 148 174 158" stroke={c.white} strokeWidth="1.6" fill="none" />
      <Loop moving={moving} y={[0, -14]} opacity={[1, 0]} duration={2.6}>
        <Heart x={200} y={104} scale={1.3} />
      </Loop>
      <ellipse cx="246" cy="162" rx="26" ry="4" fill={c.sandShade} />
      <Loop moving={moving} x={[0, -12, 0]} duration={3.2}>
        <Zeca x={250} y={140} scale={1.2} mood="shy" moving={moving} />
      </Loop>
    </g>
  );
}
