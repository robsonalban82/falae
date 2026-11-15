import { c } from './palette';

export type GiuliaMood = 'curious' | 'kind' | 'laugh' | 'teary';
type Outfit = 'dress' | 'pajamas' | 'jacket';

type Props = {
  x: number;
  y: number;
  scale?: number;
  /** `sit`: on the ground with the legs forward. */
  pose?: 'stand' | 'sit';
  outfit?: Outfit;
  mood?: GiuliaMood;
  /** Where the front hand goes, in her own coordinates (origin at the feet, facing right). */
  hand?: [number, number];
};

const mouths: Record<GiuliaMood, string> = {
  curious: 'M0 -52.5 Q2 -51 4 -52.5 Q4.5 -49.5 2 -49 Q-0.5 -49.5 0 -52.5 Z',
  kind: 'M-2 -53 Q2 -49.5 6 -53',
  laugh: 'M-3 -54 Q2 -46 7 -54 Z',
  teary: 'M-1.5 -52.5 Q2 -50 5.5 -52.5',
};

const tops: Record<Outfit, [string, string]> = {
  dress: [c.dress, c.dressShade],
  pajamas: [c.pajama, c.pajamaShade],
  jacket: [c.jacket, c.jacketShade],
};

/** Giulia, 5 years old, blonde shoulder-length hair (origin at the feet, about 75 units tall). */
export function Giulia({
  x,
  y,
  scale = 1,
  pose = 'stand',
  outfit = 'dress',
  mood = 'kind',
  hand = [11, -27],
}: Props) {
  const sit = pose === 'sit';
  const [top, topShade] = tops[outfit];
  // Pajama legs are covered; the dress shows bare legs and sandals.
  const leg = outfit === 'dress' ? c.skin : c.pajama;
  const sleeve = outfit === 'dress' ? c.skin : top;
  const filled = mood === 'laugh' || mood === 'curious';
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <g stroke={leg} strokeWidth="5.5" strokeLinecap="round" fill="none">
        {sit ? <path d="M-2 -4 L20 -3 M2 -7 L24 -5" /> : <path d="M-4 -22 L-4 -4 M4 -22 L4 -4" />}
      </g>
      {outfit === 'dress' && (
        <g fill={c.sandal}>
          {sit ? (
            <path d="M19 -7 h5 v7 h-5 Z M23 -9 h5 v7 h-5 Z" />
          ) : (
            <path d="M-8 -4 h9 v4 h-9 Z M1 -4 h9 v4 h-9 Z" />
          )}
        </g>
      )}
      <g transform={sit ? 'translate(0 17)' : undefined}>
        <path d="M-6 -44 L-11 -28" stroke={sleeve} strokeWidth="4.6" strokeLinecap="round" />
        <path
          d="M-8 -47 Q0 -50 8 -47 L14 -22 Q0 -17 -14 -22 Z"
          fill={top}
          stroke={c.outline}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M4 -46 L8 -47 L14 -22 Q10 -20 6 -20 Z" fill={topShade} opacity="0.8" />
        <path
          d="M-15 -60 Q-17 -78 0 -77 Q17 -78 15 -60 L15 -46 Q11 -43 8 -48 L-8 -48 Q-11 -43 -15 -46 Z"
          fill={c.hair}
          stroke={c.outline}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="0" cy="-60" r="12.5" fill={c.skin} />
        <path
          d="M-13 -61 Q-13 -75 0 -74.5 Q13 -75 13 -61 Q8 -68 1 -67 Q-7 -67 -13 -61 Z"
          fill={c.hair}
        />
        <path d="M11 -62 Q14 -54 12 -47" stroke={c.hairShade} strokeWidth="2" fill="none" />
        <circle cx="-3" cy="-59" r="2.1" fill={c.eye} />
        <circle cx="6.5" cy="-59" r="2.1" fill={c.eye} />
        <g fill={c.white}>
          <circle cx="-3.6" cy="-59.7" r="0.7" />
          <circle cx="5.9" cy="-59.7" r="0.7" />
        </g>
        <g fill={c.cheek} opacity="0.75">
          <circle cx="-7.5" cy="-54" r="2.6" />
          <circle cx="10" cy="-54" r="2.6" />
        </g>
        <path
          d={mouths[mood]}
          stroke={c.outline}
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={filled ? c.outline : 'none'}
        />
        {mood === 'teary' && <path d="M8 -56 Q6.5 -53 8 -52 Q9.5 -53 8 -56 Z" fill={c.tear} />}
        <path
          d={`M6 -44 L${hand[0]} ${hand[1]}`}
          stroke={sleeve}
          strokeWidth="4.6"
          strokeLinecap="round"
        />
        <circle cx={hand[0]} cy={hand[1]} r="2.8" fill={c.skin} />
      </g>
    </g>
  );
}
