import { motion, useReducedMotion, type TargetAndTransition, type Transition } from 'motion/react';
import { t } from '../../i18n/pt-BR';

export type TucaMood = 'happy' | 'celebrating' | 'sad' | 'encouraging' | 'thinking';

type Props = {
  mood?: TucaMood;
  size?: number;
  className?: string;
  /** Decorative mascots (next to text that already says the same) should be hidden from screen readers. */
  decorative?: boolean;
};

type Pose = {
  body: TargetAndTransition;
  bodyTransition?: Transition;
  head: TargetAndTransition;
  beak: TargetAndTransition;
  wing: TargetAndTransition;
  wingTransition?: Transition;
};

const loop = (duration: number): Transition => ({ duration, repeat: Infinity, ease: 'easeInOut' });

/*
 * Wing hangs from (78, 98). Negative rotation swings it forward (towards the beak):
 * -130 = raised "you got this" wave, -100 = wing tip under the beak (thinking).
 */
const poses: Record<TucaMood, Pose> = {
  happy: {
    body: { y: [0, -3, 0] },
    bodyTransition: loop(2.4),
    head: { rotate: 0 },
    beak: { rotate: 0 },
    wing: { rotate: 0 },
  },
  celebrating: {
    body: { y: [0, -16, 0], rotate: [0, -3, 3, 0] },
    bodyTransition: loop(0.7),
    head: { rotate: -10 },
    beak: { rotate: -6 },
    wing: { rotate: [-150, -110, -150] },
    wingTransition: loop(0.35),
  },
  sad: {
    body: { y: 4 },
    head: { rotate: 12, y: 3 },
    beak: { rotate: 10 },
    wing: { rotate: 6 },
  },
  encouraging: {
    body: { rotate: 4, y: [0, -3, 0] },
    bodyTransition: loop(1.6),
    head: { rotate: -4 },
    beak: { rotate: -4 },
    wing: { rotate: [-130, -140, -130] },
    wingTransition: loop(0.9),
  },
  thinking: {
    body: { y: 0 },
    head: { rotate: [-6, -9, -6] },
    beak: { rotate: -2 },
    wing: { rotate: -100 },
  },
};

/** Tuca, the Falaê toucan (3/4 profile, facing right). Original SVG art; colors from --tuca-* tokens. */
export function Tuca({ mood = 'happy', size = 160, className, decorative = false }: Props) {
  const reduce = useReducedMotion() ?? false;
  const pose = poses[mood];
  // With reduced motion keep the pose (first keyframe) and drop loops.
  // Object.fromEntries loses the key types, hence the casts back to the motion target type.
  const pick = (target: TargetAndTransition): TargetAndTransition =>
    reduce
      ? (Object.fromEntries(
          Object.entries(target).map(([k, v]) => [k, Array.isArray(v) ? (v[0] as unknown) : v]),
        ) as TargetAndTransition)
      : target;
  const instant: Transition = { duration: 0 };
  const motionFor = (target: TargetAndTransition, transition?: Transition) => ({
    animate: pick(target),
    transition: reduce ? instant : (transition ?? { duration: 0.3 }),
  });

  const pupil =
    mood === 'sad' ? { x: 0, y: 3 } : mood === 'thinking' ? { x: 1, y: -5 } : { x: 2, y: 0 };
  const blink = !reduce && (mood === 'happy' || mood === 'encouraging');
  const eyeR = mood === 'encouraging' ? 9.5 : 8.5;

  return (
    <svg
      viewBox="0 0 220 210"
      width={size}
      height={(size * 210) / 220}
      className={className}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : t.mascot.moods[mood]}
      data-mood={mood}
      style={{ overflow: 'visible' }}
    >
      <motion.g
        {...motionFor(pose.body, pose.bodyTransition)}
        style={{ transformOrigin: '95px 200px', transformBox: 'view-box' }}
      >
        {/* tail */}
        <path d="M58 168 L38 204 L62 206 L78 176 Z" className="fill-tuca-body-shade" />
        {/* feet */}
        <g className="fill-tuca-feet">
          <rect x="80" y="188" width="18" height="9" rx="4.5" />
          <rect x="102" y="188" width="18" height="9" rx="4.5" />
        </g>

        {/* body: elongated, slightly leaning back */}
        <ellipse
          cx="94"
          cy="134"
          rx="44"
          ry="58"
          transform="rotate(-8 94 134)"
          className="fill-tuca-body"
        />
        {/* cream bib separates the beak from the body */}
        <path
          d="M100 86 Q134 92 132 124 Q128 150 108 156 Q96 128 100 86 Z"
          className="fill-tuca-bib"
        />
        <path
          d="M108 156 Q128 150 132 124 Q134 140 126 152 Q118 160 108 156 Z"
          className="fill-tuca-chest"
        />

        {/* head + beak */}
        <motion.g
          {...motionFor(pose.head, pose.bodyTransition)}
          style={{ transformOrigin: '100px 96px', transformBox: 'view-box' }}
        >
          <circle cx="102" cy="62" r="34" className="fill-tuca-body" />
          <ellipse cx="116" cy="74" rx="14" ry="12" className="fill-tuca-bib" />

          {/* banana beak, longer than the head is wide */}
          <motion.g
            {...motionFor(pose.beak)}
            style={{ transformOrigin: '128px 64px', transformBox: 'view-box' }}
          >
            <path
              d="M124 46 C148 30 192 32 210 58 C196 64 158 64 128 70 Z"
              className="fill-tuca-beak-top"
            />
            <path
              d="M128 70 C158 64 196 64 210 58 C200 78 162 86 126 82 Z"
              className="fill-tuca-beak-bottom"
            />
            <path
              d="M200 54 C206 56 210 58 210 58 C206 64 202 66 198 66 Z"
              className="fill-tuca-beak-tip"
            />
            <path
              d="M130 52 C152 42 182 42 198 52"
              className="stroke-tuca-beak-ridge"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
            />
          </motion.g>

          {/* eye */}
          <circle cx="108" cy="54" r="13" className="fill-tuca-ring" />
          {mood === 'celebrating' ? (
            <path
              d="M100 57 q8 -11 16 0"
              className="stroke-tuca-pupil"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
          ) : (
            <motion.g
              animate={blink ? { scaleY: [1, 1, 0.1, 1] } : { scaleY: 1 }}
              transition={
                blink ? { duration: 4, times: [0, 0.92, 0.96, 1], repeat: Infinity } : instant
              }
              style={{ transformOrigin: '108px 54px', transformBox: 'view-box' }}
            >
              <circle cx="108" cy="54" r={eyeR} className="fill-tuca-eye" />
              <circle cx={108 + pupil.x} cy={54 + pupil.y} r="4.8" className="fill-tuca-pupil" />
              <circle
                cx={110 + pupil.x}
                cy={52 + pupil.y}
                r={mood === 'encouraging' ? 2.4 : 1.6}
                className="fill-tuca-eye"
              />
            </motion.g>
          )}

          {/* brow: sad = front end raised (worried, not angry); thinking = arched */}
          {mood === 'sad' && (
            <path
              d="M96 40 L118 34"
              className="stroke-tuca-pupil"
              strokeWidth="4"
              strokeLinecap="round"
            />
          )}
          {mood === 'thinking' && (
            <path
              d="M96 36 q12 -10 24 -2"
              className="stroke-tuca-pupil"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
          )}
          {mood === 'sad' && (
            <path d="M104 70 q-4 8 0 11 q4 -3 0 -11 Z" className="fill-tuca-ring" />
          )}

          {/* cheek */}
          {(mood === 'happy' || mood === 'celebrating' || mood === 'encouraging') && (
            <ellipse cx="96" cy="74" rx="7" ry="4.5" className="fill-tuca-cheek" opacity="0.6" />
          )}
        </motion.g>

        {/* wing (in front of body) */}
        <motion.path
          d="M78 98 C98 104 102 150 86 172 C70 160 62 120 78 98 Z"
          className="fill-tuca-body-shade"
          {...motionFor(pose.wing, pose.wingTransition)}
          style={{ transformOrigin: '80px 100px', transformBox: 'view-box' }}
        />
      </motion.g>

      {mood === 'thinking' && (
        <g className="fill-tuca-body-shade" aria-hidden="true">
          <circle cx="150" cy="18" r="4" />
          <circle cx="164" cy="12" r="5" />
          <circle cx="180" cy="6" r="6" />
        </g>
      )}
    </svg>
  );
}
