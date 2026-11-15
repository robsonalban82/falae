import { Giulia } from '../Giulia';
import { Loop } from '../Loop';
import { c } from '../palette';
import { Zeca } from '../Zeca';
import type { SceneProps } from './sceneProps';

const STARS: [number, number][] = [
  [188, 34],
  [214, 26],
  [236, 44],
  [282, 30],
];

/** Scene 6: at nightfall Zeca misses home and looks at the sea from the desk. */
export function TwilightScene({ moving }: SceneProps) {
  return (
    <g>
      <rect width="320" height="180" fill={c.wallNight} />
      <rect y="156" width="320" height="24" fill={c.floorNight} />
      <g opacity="0.8">
        <Giulia x={64} y={172} scale={1.2} outfit="pajamas" mood="kind" />
      </g>
      <rect
        x="168"
        y="14"
        width="128"
        height="88"
        rx="4"
        fill={c.skyNight}
        stroke={c.wood}
        strokeWidth="4"
      />
      <rect x="170" y="74" width="124" height="26" fill={c.seaNight} />
      <circle cx="262" cy="38" r="10" fill={c.moon} />
      <Loop moving={moving} opacity={[0.7, 0.25, 0.7]} duration={3}>
        <path
          d="M252 80 h20 M248 88 h28 M254 96 h16"
          stroke={c.moon}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </Loop>
      {STARS.map(([x, y], i) => (
        <Loop key={i} moving={moving} opacity={[1, 0.3, 1]} duration={2 + i * 0.5} delay={i * 0.4}>
          <circle cx={x} cy={y} r="1.4" fill={c.moon} />
        </Loop>
      ))}
      <rect
        x="150"
        y="126"
        width="170"
        height="10"
        rx="3"
        fill={c.wood}
        stroke={c.outline}
        strokeWidth="1.6"
      />
      <rect x="164" y="136" width="10" height="36" fill={c.woodShade} />
      <rect x="300" y="136" width="10" height="36" fill={c.woodShade} />
      <Loop moving={moving} rotate={[0, -2, 0]} duration={4}>
        <Zeca x={226} y={110} scale={1.1} mood="sad" moving={moving} />
      </Loop>
    </g>
  );
}
