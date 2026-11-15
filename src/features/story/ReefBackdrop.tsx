import { Loop } from './Loop';
import { c } from './palette';

const BUBBLES: [number, number, number][] = [
  [28, 120, 2.5],
  [62, 96, 1.8],
  [176, 110, 2.2],
  [298, 90, 2],
];

/** Underwater reef with the family cave on the right (day, or night with glowing corals). */
export function ReefBackdrop({ night = false, moving }: { night?: boolean; moving: boolean }) {
  const sand = night ? c.sandNight : c.sand;
  const sandShade = night ? c.sandNightShade : c.sandShade;
  return (
    <g>
      <rect width="320" height="180" fill={night ? c.waterNight : c.water} />
      <rect width="320" height="46" fill={night ? c.waterNightLight : c.waterLight} />
      <Loop moving={moving} opacity={[0.28, 0.12, 0.28]} duration={5}>
        <path
          d="M60 0 L20 150 L64 150 L96 0 Z M170 0 L150 150 L196 150 L204 0 Z"
          fill={night ? c.moon : c.white}
        />
      </Loop>
      {/* cave */}
      <path
        d="M196 150 Q190 96 232 88 Q286 78 312 110 Q324 130 320 150 Z"
        fill={c.rock}
        stroke={c.outline}
        strokeWidth="1.8"
      />
      <path d="M286 92 Q322 112 320 150 H300 Q306 118 286 92 Z" fill={c.rockShade} />
      <path d="M226 150 Q224 112 254 110 Q284 112 282 150 Z" fill={c.cave} />
      {/* seaweed */}
      {[14, 182, 306].map((x, i) => (
        <Loop key={x} moving={moving} rotate={[-5, 5, -5]} duration={4 + i}>
          <path
            d={`M${x} 152 q-8 -16 0 -30 q8 -14 0 -28`}
            stroke={c.seaweed}
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
        </Loop>
      ))}
      {/* corals */}
      <Loop moving={moving && night} opacity={[1, 0.55, 1]} duration={2.6}>
        <g stroke={c.outline} strokeWidth="1.4">
          <path
            d="M36 152 v-22 q0 -6 5 -6 q5 0 5 6 v6 q6 -2 6 -10 q0 -5 5 -5 q5 0 5 5 q0 16 -12 20 v6 Z"
            fill={night ? c.glow : c.coralPink}
          />
          <circle cx="76" cy="146" r="9" fill={night ? c.glow : c.coralYellow} />
          <path
            d="M150 152 q-10 -22 2 -30 q4 10 8 0 q12 10 2 30 Z"
            fill={night ? c.glow : c.coralPurple}
          />
        </g>
      </Loop>
      <path d="M0 150 Q90 142 170 150 Q250 157 320 147 V180 H0 Z" fill={sand} />
      <g fill={sandShade}>
        <ellipse cx="110" cy="168" rx="18" ry="3" />
        <ellipse cx="250" cy="170" rx="22" ry="3" />
      </g>
      {BUBBLES.map(([x, y, r], i) => (
        <Loop
          key={i}
          moving={moving}
          y={[0, -60]}
          opacity={[0.8, 0]}
          duration={5 + i}
          delay={i * 0.8}
        >
          <circle cx={x} cy={y} r={r} fill="none" stroke={c.white} strokeWidth="1.2" />
        </Loop>
      ))}
    </g>
  );
}
