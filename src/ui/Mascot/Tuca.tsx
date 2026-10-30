import { motion, useReducedMotion, type TargetAndTransition, type Transition } from 'motion/react';
import { t } from '../../i18n/pt-BR';
import celebrating from './img/tuca-comemorando.webp';
import encouraging from './img/tuca-encorajando.webp';
import happy from './img/tuca-feliz.webp';
import thinking from './img/tuca-pensando.webp';
import sad from './img/tuca-triste.webp';

export type TucaMood = 'happy' | 'celebrating' | 'sad' | 'encouraging' | 'thinking';

type Props = {
  mood?: TucaMood;
  size?: number;
  className?: string;
  /** Decorative mascots (next to text that already says the same) should be hidden from screen readers. */
  decorative?: boolean;
};

const art: Record<TucaMood, string> = { happy, celebrating, sad, encouraging, thinking };

const loop = (duration: number): Transition => ({ duration, repeat: Infinity, ease: 'easeInOut' });

/** Whole-body motion per mood; the pose itself is in the artwork. */
const poses: Record<TucaMood, { animate: TargetAndTransition; transition?: Transition }> = {
  happy: { animate: { y: [0, -4, 0] }, transition: loop(2.4) },
  celebrating: { animate: { y: [0, -14, 0], rotate: [0, -3, 3, 0] }, transition: loop(0.8) },
  sad: { animate: { y: 3 } },
  encouraging: { animate: { rotate: [0, 3, 0] }, transition: loop(1.6) },
  thinking: { animate: { rotate: [0, -2, 0] }, transition: loop(3) },
};

/** Tuca, the Falaê toucan. Original artwork, one image per mood. */
export function Tuca({ mood = 'happy', size = 160, className, decorative = false }: Props) {
  const reduce = useReducedMotion() ?? false;
  const pose = poses[mood];
  // With reduced motion keep the pose (first keyframe) and drop loops.
  // Object.fromEntries loses the key types, hence the cast back to the motion target type.
  const animate = reduce
    ? (Object.fromEntries(
        Object.entries(pose.animate).map(([k, v]) => [k, Array.isArray(v) ? (v[0] as unknown) : v]),
      ) as TargetAndTransition)
    : pose.animate;

  return (
    <motion.img
      src={art[mood]}
      width={size}
      height={size}
      alt={decorative ? '' : t.mascot.moods[mood]}
      aria-hidden={decorative || undefined}
      data-mood={mood}
      draggable={false}
      decoding="async"
      className={`select-none tuca-glow ${className ?? ''}`}
      style={{ transformOrigin: '50% 100%' }}
      initial={false}
      animate={animate}
      transition={reduce ? { duration: 0 } : (pose.transition ?? { duration: 0.3 })}
    />
  );
}
