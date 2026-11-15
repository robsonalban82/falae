import { motion, type TargetAndTransition } from 'motion/react';
import type { ReactNode } from 'react';

type Props = {
  /** False while paused or with reduced motion: the group rests on its first keyframe. */
  moving: boolean;
  x?: number[];
  y?: number[];
  rotate?: number[];
  scale?: number[];
  opacity?: number[];
  /** Seconds per cycle. */
  duration?: number;
  delay?: number;
  children: ReactNode;
};

/** SVG group that repeats its keyframes forever while the story is playing. */
export function Loop({ moving, duration = 3, delay = 0, children, ...frames }: Props) {
  const target: TargetAndTransition = {};
  for (const [key, values] of Object.entries(frames)) {
    const first = values?.[0];
    if (first !== undefined) Object.assign(target, { [key]: moving && values ? values : first });
  }
  return (
    <motion.g
      initial={false}
      animate={target}
      transition={
        moving ? { duration, delay, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }
      }
    >
      {children}
    </motion.g>
  );
}
