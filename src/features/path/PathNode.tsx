import { Link } from 'react-router';
import { paths } from '../../app/routes';
import type { LessonNode } from '../../domain/progression/pathState';
import { t } from '../../i18n/pt-BR';
import { CheckIcon, CrownIcon, LockIcon, StarIcon, TrophyIcon } from '../../ui/icons';
import type { unitTheme } from './unitTheme';

type Props = {
  node: LessonNode;
  label: string;
  theme: (typeof unitTheme)[keyof typeof unitTheme];
  offsetClass: string;
  /** Crown over the last node of a crowned skill (silver when tested out). */
  crown: 'gold' | 'silver' | null;
  reduceMotion: boolean;
  onLockedPress: (node: LessonNode) => void;
  nodeRef?: (el: HTMLElement | null) => void;
};

/** One lesson on the path. Open → link; locked → focusable aria-disabled button that explains why. */
export function PathNode({
  node,
  label,
  theme,
  offsetClass,
  crown,
  reduceMotion,
  onLockedPress,
  nodeRef,
}: Props) {
  const isReview = node.skillId === null;
  const isCurrent = node.status === 'current';
  const isLocked = node.status === 'locked';
  const size = isCurrent ? 'h-20 w-20' : 'h-16 w-16';
  const look = isLocked ? 'bg-surface-2 text-ink-muted border-line-strong' : theme.node;
  const icon = isLocked ? (
    <LockIcon size={26} />
  ) : node.status === 'completed' ? (
    <CheckIcon size={30} />
  ) : isReview ? (
    <TrophyIcon size={30} />
  ) : (
    <StarIcon size={30} />
  );
  const circle = `relative flex ${size} items-center justify-center rounded-full border-b-[6px] font-display shadow-md transition-transform active:translate-y-0.5 ${look}`;

  const inner = (
    <>
      {isCurrent && !reduceMotion && (
        <span
          aria-hidden="true"
          className={`absolute inset-0 -z-10 animate-ping rounded-full opacity-40 motion-reduce:hidden ${theme.ring}`}
        />
      )}
      {isCurrent && (
        <span
          aria-hidden="true"
          className="absolute -inset-2 -z-10 rounded-full border-4 border-line-strong"
        />
      )}
      {icon}
      {crown && (
        <span
          aria-hidden="true"
          className={`absolute -top-3 -right-3 rounded-full border-2 p-1 shadow ${
            crown === 'gold'
              ? 'border-on-xp bg-xp text-on-xp'
              : 'border-line-strong bg-surface-2 text-ink-muted'
          }`}
        >
          <CrownIcon size={20} />
        </span>
      )}
    </>
  );

  return (
    <li className={`relative flex flex-col items-center ${offsetClass}`}>
      {isCurrent && (
        <span
          aria-hidden="true"
          className="mb-2 rounded-xl border-2 border-line-strong bg-surface px-3 py-1 font-display font-semibold text-ink shadow-sm"
        >
          {t.path.start}
        </span>
      )}
      {isLocked ? (
        <button
          type="button"
          aria-disabled="true"
          aria-label={label}
          className={`${circle} cursor-not-allowed`}
          onClick={() => onLockedPress(node)}
          ref={nodeRef}
        >
          {inner}
        </button>
      ) : (
        <Link
          to={paths.lesson(node.lessonId)}
          aria-label={label}
          aria-current={isCurrent ? 'step' : undefined}
          className={circle}
          ref={nodeRef}
        >
          {inner}
        </Link>
      )}
    </li>
  );
}
