import { BeachBackdrop } from '../BeachBackdrop';
import { Giulia } from '../Giulia';
import { Loop } from '../Loop';
import { c } from '../palette';
import { Zeca } from '../Zeca';
import type { SceneProps } from './sceneProps';

/** Scene 2: Giulia reaches a finger toward Zeca, who gets a big fright. */
export function BeachFrightScene({ moving }: SceneProps) {
  return (
    <g>
      <BeachBackdrop moving={moving} />
      <Loop moving={moving} rotate={[0, 2, 0]} duration={2.4}>
        <Giulia x={146} y={156} scale={1.35} pose="sit" mood="curious" hand={[22, -38]} />
      </Loop>
      <Loop moving={moving} opacity={[1, 0.2, 1]} duration={0.8}>
        <path
          d="M210 96 L204 86 M226 92 V80 M242 96 L248 86"
          stroke={c.outline}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </Loop>
      <ellipse cx="226" cy="160" rx="26" ry="4" fill={c.sandShade} />
      <Loop moving={moving} x={[0, -2, 2, 0]} duration={0.3}>
        <Zeca x={226} y={138} scale={1.2} mood="scared" moving={moving} />
      </Loop>
    </g>
  );
}
