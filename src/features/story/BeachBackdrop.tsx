import { Loop } from './Loop';
import { c } from './palette';

const STARS: [number, number][] = [
  [30, 18],
  [78, 34],
  [120, 12],
  [170, 30],
  [215, 14],
  [300, 44],
];

/** Sky, sea and sand of the beach scenes (day or moonlit night). */
export function BeachBackdrop({ night = false, moving }: { night?: boolean; moving: boolean }) {
  const sea = night ? c.seaNight : c.sea;
  const seaDeep = night ? c.seaNightDeep : c.seaDeep;
  return (
    <g>
      <rect width="320" height="90" fill={night ? c.skyNight : c.sky} />
      {night ? (
        <>
          {STARS.map(([x, y], i) => (
            <Loop
              key={i}
              moving={moving}
              opacity={[1, 0.3, 1]}
              duration={2 + (i % 3)}
              delay={i * 0.3}
            >
              <circle cx={x} cy={y} r="1.4" fill={c.moon} />
            </Loop>
          ))}
          <circle cx="262" cy="30" r="15" fill={c.moon} />
        </>
      ) : (
        <>
          <Loop moving={moving} scale={[1, 1.08, 1]} duration={4}>
            <circle cx="262" cy="30" r="16" fill={c.sun} />
          </Loop>
          <Loop moving={moving} x={[0, 14, 0]} duration={14}>
            <path d="M40 30 q8 -12 20 -4 q12 -8 18 4 q8 2 4 8 h-44 q-6 -4 2 -8 Z" fill={c.cloud} />
          </Loop>
        </>
      )}
      <rect y="68" width="320" height="44" fill={seaDeep} />
      <rect y="80" width="320" height="32" fill={sea} />
      {night && (
        <Loop moving={moving} opacity={[0.7, 0.3, 0.7]} duration={3}>
          <path
            d="M250 72 h24 M244 80 h36 M252 88 h20 M246 96 h32"
            stroke={c.moon}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </Loop>
      )}
      <Loop moving={moving} x={[0, 10, 0]} duration={5}>
        <path
          d="M-10 76 q10 -5 20 0 M70 84 q10 -5 20 0 M150 76 q10 -5 20 0 M190 92 q10 -5 20 0 M20 94 q10 -5 20 0"
          stroke={c.white}
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          opacity={night ? 0.35 : 0.8}
        />
      </Loop>
      <path
        d="M0 106 Q80 98 160 105 Q240 112 320 102 V180 H0 Z"
        fill={night ? c.sandNight : c.sand}
      />
      <Loop moving={moving} y={[0, 2.5, 0]} duration={4}>
        <path
          d="M0 106 Q80 98 160 105 Q240 112 320 102"
          stroke={c.white}
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          opacity={night ? 0.5 : 0.9}
        />
      </Loop>
      <g fill={night ? c.sandNightShade : c.sandShade}>
        <ellipse cx="46" cy="166" rx="16" ry="3" />
        <ellipse cx="282" cy="160" rx="20" ry="3" />
        <circle cx="150" cy="170" r="1.6" />
        <circle cx="210" cy="126" r="1.6" />
        <circle cx="64" cy="128" r="1.6" />
      </g>
    </g>
  );
}
