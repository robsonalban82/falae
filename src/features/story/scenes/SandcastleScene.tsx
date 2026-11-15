import { BeachBackdrop } from '../BeachBackdrop';
import { Giulia } from '../Giulia';
import { Loop } from '../Loop';
import { c } from '../palette';
import { Zeca } from '../Zeca';
import type { SceneProps } from './sceneProps';

const GRAINS: [number, number][] = [
  [262, 150],
  [270, 146],
  [278, 152],
  [286, 148],
];

/** Scene 4: Giulia builds a sandcastle while Zeca digs a tunnel. */
export function SandcastleScene({ moving }: SceneProps) {
  return (
    <g>
      <BeachBackdrop moving={moving} />
      <Loop moving={moving} rotate={[0, -2, 0]} duration={1.6}>
        <Giulia x={80} y={158} scale={1.35} pose="sit" mood="laugh" hand={[28, -20]} />
      </Loop>
      <path
        d="M118 160 L122 140 H140 L144 160 Z"
        fill={c.bucket}
        stroke={c.outline}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M121 140 Q131 126 141 140" stroke={c.outline} strokeWidth="1.6" fill="none" />
      <g fill={c.sand} stroke={c.outline} strokeWidth="1.6" strokeLinejoin="round">
        <path d="M156 160 V132 h6 v-5 h6 v5 h8 v-5 h6 v5 h8 v-5 h6 v5 h6 V160 Z" />
        <path d="M172 132 V112 h4 v-4 h5 v4 h5 v-4 h5 v4 h4 V132 Z" />
      </g>
      <path d="M176 160 v-10 q6 -8 12 0 v10 Z" fill={c.sandShade} />
      <path d="M184 108 V94" stroke={c.outline} strokeWidth="1.6" strokeLinecap="round" />
      <Loop moving={moving} rotate={[-6, 6, -6]} duration={1.2}>
        <path d="M184 94 L196 98 L184 102 Z" fill={c.bucket} />
      </Loop>
      <ellipse cx="262" cy="160" rx="13" ry="5" fill={c.sandShade} />
      {GRAINS.map(([x, y], i) => (
        <Loop
          key={i}
          moving={moving}
          y={[0, -18, 0]}
          x={[0, 6 + i * 3, 10 + i * 4]}
          opacity={[1, 1, 0]}
          duration={0.9}
          delay={i * 0.15}
        >
          <circle cx={x} cy={y} r="2" fill={c.sandShade} stroke={c.outline} strokeWidth="0.6" />
        </Loop>
      ))}
      <Loop moving={moving} rotate={[-7, 7, -7]} duration={0.5}>
        <Zeca x={236} y={144} scale={1.1} moving={moving} />
      </Loop>
    </g>
  );
}
