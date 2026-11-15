import { Heart } from '../Heart';
import { Loop } from '../Loop';
import { ReefBackdrop } from '../ReefBackdrop';
import { Zeca } from '../Zeca';
import type { SceneProps } from './sceneProps';

const HEARTS: [number, number][] = [
  [92, 84],
  [124, 70],
  [158, 86],
];

/** Scene 8: back home, Zeca hugs his parents in front of the cave. */
export function ReunionScene({ moving }: SceneProps) {
  return (
    <g>
      <ReefBackdrop night moving={moving} />
      {HEARTS.map(([x, y], i) => (
        <Loop key={i} moving={moving} y={[0, -22]} opacity={[1, 0]} duration={2.6} delay={i * 0.7}>
          <Heart x={x} y={y} scale={1.2} />
        </Loop>
      ))}
      <Loop moving={moving} rotate={[-2, 2, -2]} duration={2.4}>
        <Zeca x={78} y={128} scale={1.25} star={false} moving={moving} />
        <Zeca x={174} y={128} scale={1.25} star={false} moving={moving} />
        <Zeca x={126} y={140} scale={1.05} moving={moving} />
      </Loop>
    </g>
  );
}
