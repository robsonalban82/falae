import { BeachBackdrop } from '../BeachBackdrop';
import { Giulia } from '../Giulia';
import { Loop } from '../Loop';
import { c } from '../palette';
import { Zeca } from '../Zeca';
import type { SceneProps } from './sceneProps';

/** Scene 7: goodbye on the moonlit beach, claw against fingertip. */
export function FarewellScene({ moving }: SceneProps) {
  return (
    <g>
      <BeachBackdrop night moving={moving} />
      <Giulia
        x={140}
        y={158}
        scale={1.35}
        pose="sit"
        outfit="jacket"
        mood="teary"
        hand={[22, -40]}
      />
      <ellipse cx="204" cy="162" rx="26" ry="4" fill={c.sandNightShade} />
      <Loop moving={moving} y={[0, -1.5, 0]} duration={2}>
        <Zeca x={204} y={140} scale={1.2} mood="happy" moving={moving} />
      </Loop>
      <Loop moving={moving} scale={[0.6, 1.5, 0.6]} opacity={[0.9, 0.2, 0.9]} duration={2}>
        <circle cx="171" cy="127" r="8" fill={c.moon} />
      </Loop>
    </g>
  );
}
