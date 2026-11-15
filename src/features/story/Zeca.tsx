import { Loop } from './Loop';
import { c } from './palette';

export type ZecaMood = 'happy' | 'dreamy' | 'scared' | 'shy' | 'sad';

type Props = {
  x: number;
  y: number;
  scale?: number;
  mood?: ZecaMood;
  /** Zeca has a white star on the shell; his parents do not. */
  star?: boolean;
  moving: boolean;
};

const mouths: Record<ZecaMood, string> = {
  happy: 'M-6 5 Q0 12 6 5',
  dreamy: 'M-4 6 Q0 9 4 6',
  scared: 'M-3 5 Q0 2 3 5 Q4 10 0 11 Q-4 10 -3 5 Z',
  shy: 'M-3 7 Q0 9 3 7',
  sad: 'M-5 9 Q0 5 5 9',
};

/** Claw height per mood: raised when scared, low when sad. */
const clawY: Record<ZecaMood, number> = { happy: -11, dreamy: -8, scared: -24, shy: -4, sad: 5 };
/** Pupil offset per mood (dreamy looks up, shy and sad look down). */
const gaze: Record<ZecaMood, [number, number]> = {
  happy: [0, 0],
  dreamy: [1, -2.5],
  scared: [0, -1],
  shy: [-1.5, 1.5],
  sad: [1.5, 2],
};

/** Zeca, the little crab (origin at the middle of the shell, about 60 units wide). */
export function Zeca({ x, y, scale = 1, mood = 'happy', star = true, moving }: Props) {
  const claw = clawY[mood];
  const [gx, gy] = gaze[mood];
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <g stroke={c.crabShade} strokeWidth="3.2" strokeLinecap="round" fill="none">
        <path d="M-12 8 L-21 15 M-14 4 L-24 9 M-9 11 L-15 19" />
        <path d="M12 8 L21 15 M14 4 L24 9 M9 11 L15 19" />
        <path d={`M-15 -1 L-25 ${claw + 4}`} />
        <path d={`M15 -1 L25 ${claw + 4}`} />
      </g>
      {[-1, 1].map((side) => (
        <g key={side} transform={`translate(${side * 27} ${claw})`}>
          <circle r="7" fill={c.crab} stroke={c.outline} strokeWidth="1.6" />
          <path
            d={`M0 0 L${side * 5} -6`}
            stroke={c.outline}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </g>
      ))}
      <ellipse cx="0" cy="2" rx="17" ry="12.5" fill={c.crab} stroke={c.outline} strokeWidth="1.8" />
      <path d="M-13 8 Q0 17 13 8 Q0 12 -13 8 Z" fill={c.crabShade} />
      <path
        d="M-11 -3 Q-8 -8 -2 -8"
        stroke={c.white}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      {star && (
        <path
          d="M9 -6 L10.2 -3.4 L13 -3.1 L10.9 -1.2 L11.5 1.6 L9 0.2 L6.5 1.6 L7.1 -1.2 L5 -3.1 L7.8 -3.4 Z"
          fill={c.white}
        />
      )}
      {[-1, 1].map((side) => (
        <g key={side}>
          <path
            d={`M${side * 6} -9 L${side * 7} -17`}
            stroke={c.crabShade}
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <circle
            cx={side * 7}
            cy="-21"
            r="6.2"
            fill={c.white}
            stroke={c.outline}
            strokeWidth="1.6"
          />
          <circle cx={side * 7 + gx} cy={-21 + gy} r="3" fill={c.outline} />
          <circle cx={side * 7 + gx - 1} cy={-22 + gy} r="1" fill={c.white} />
        </g>
      ))}
      {mood === 'shy' && (
        <g fill={c.cheek} opacity="0.8">
          <circle cx="-10" cy="4" r="2.6" />
          <circle cx="10" cy="4" r="2.6" />
        </g>
      )}
      <path
        d={mouths[mood]}
        stroke={c.outline}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={mood === 'scared' ? c.outline : 'none'}
      />
      {mood === 'sad' && (
        <Loop moving={moving} y={[0, 9, 0]} opacity={[1, 0.2, 1]} duration={2.2}>
          <path d="M-9 -13 Q-12 -8 -9 -6 Q-6 -8 -9 -13 Z" fill={c.tear} />
        </Loop>
      )}
    </g>
  );
}
