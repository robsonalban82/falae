import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n/pt-BR';
import { formatWait } from '../../ui/formatTime';
import { HeartIcon } from '../../ui/icons';

type Props = {
  hearts: number;
  /** Shows "próximo em …" when given and not full. */
  nextHeartInMs?: number | null;
  /** Shrinks/shakes (or fades, with reduced motion) and announces when a heart is lost. */
  announceLoss?: boolean;
};

export function HeartsBadge({ hearts, nextHeartInMs, announceLoss = false }: Props) {
  const reduce = useReducedMotion() ?? false;
  const previous = useRef(hearts);
  const [lost, setLost] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (announceLoss && hearts < previous.current) {
      setLost((n) => n + 1);
      setMessage(t.lesson.feedback.lostHeart(hearts));
    }
    previous.current = hearts;
  }, [hearts, announceLoss]);

  const animate =
    lost === 0
      ? {}
      : reduce
        ? { opacity: [1, 0.4, 1] }
        : { scale: [1, 0.7, 1.1, 1], x: [0, -3, 3, -2, 0] };

  return (
    <span className="inline-flex items-center gap-2">
      <motion.span
        key={lost}
        role="img"
        aria-label={t.lesson.hearts(hearts)}
        animate={animate}
        transition={{ duration: 0.3 }}
        className="inline-flex items-center gap-1 font-display text-xl font-semibold text-danger"
      >
        <HeartIcon />
        <span className="tabular" aria-hidden="true">
          {hearts}
        </span>
      </motion.span>
      {nextHeartInMs !== undefined && nextHeartInMs !== null && (
        <span className="text-sm text-ink-muted">
          {t.header.nextHeart(formatWait(nextHeartInMs))}
        </span>
      )}
      {announceLoss && (
        <span aria-live="polite" className="sr-only">
          {message}
        </span>
      )}
    </span>
  );
}
