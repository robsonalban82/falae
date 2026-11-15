import { Fish } from '../Fish';
import { Loop } from '../Loop';
import { c } from '../palette';
import { ReefBackdrop } from '../ReefBackdrop';
import { Zeca } from '../Zeca';
import type { SceneProps } from './sceneProps';

/** Scene 1: Zeca on a rock, looking up at the surface; his parents by the cave. */
export function ReefDreamScene({ moving }: SceneProps) {
  return (
    <g>
      <ReefBackdrop moving={moving} />
      <Loop moving={moving} x={[-40, 360]} duration={16}>
        <Fish x={0} y={52} color={c.fish} />
      </Loop>
      <Loop moving={moving} x={[-90, 340]} duration={22} delay={2}>
        <Fish x={60} y={78} color={c.fishAlt} />
      </Loop>
      <Zeca x={240} y={138} scale={0.85} star={false} moving={moving} />
      <Zeca x={276} y={141} scale={0.85} star={false} moving={moving} />
      <path
        d="M84 152 Q82 124 104 120 Q130 114 142 128 Q150 138 148 152 Z"
        fill={c.rock}
        stroke={c.outline}
        strokeWidth="1.8"
      />
      <path d="M132 120 Q152 134 148 152 H136 Q142 134 132 120 Z" fill={c.rockShade} />
      <Loop moving={moving} y={[0, -3, 0]} duration={3}>
        <Zeca x={114} y={106} mood="dreamy" moving={moving} />
      </Loop>
    </g>
  );
}
