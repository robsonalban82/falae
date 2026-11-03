import { Link } from 'react-router';
import { paths } from '../../app/routes';
import type { ManifestUnit } from '../../content/buildManifest';
import type { LessonNode, UnitState } from '../../domain/progression/pathState';
import { t } from '../../i18n/pt-BR';
import { BulbIcon, LockIcon } from '../../ui/icons';
import { PathNode } from './PathNode';
import { unitTheme, windingOffset } from './unitTheme';

type Props = {
  unit: ManifestUnit;
  state: UnitState;
  number: number;
  reduceMotion: boolean;
  onLockedPress: (node: LessonNode) => void;
  currentRef: (el: HTMLElement | null) => void;
};

export function UnitSection({
  unit,
  state,
  number,
  reduceMotion,
  onLockedPress,
  currentRef,
}: Props) {
  const theme = unitTheme[unit.color];
  const headingId = `unit-${unit.id}`;
  let step = 0;
  const refFor = (node: LessonNode) => (node.status === 'current' ? currentRef : undefined);

  const anyCompleted =
    state.review.status === 'completed' ||
    state.skills.some((sk) => sk.nodes.some((n) => n.status === 'completed'));
  // Future locked units are collapsed to their header + a short summary.
  if (!state.unlocked && !anyCompleted) {
    return (
      <section
        aria-labelledby={headingId}
        className="mb-6 scroll-mt-[calc(var(--notice-h,0px)+var(--path-header-h,4.5rem))]"
      >
        <header className="flex items-center gap-4 rounded-card border-2 border-line-strong bg-surface-2 px-5 py-4 text-ink">
          <LockIcon size={24} className="shrink-0 text-ink-muted" />
          <div>
            <p className="text-sm font-bold tracking-wide text-ink-muted uppercase">
              {t.path.unit(number)}
            </p>
            <h2 id={headingId} className="text-xl font-semibold">
              {unit.title}
            </h2>
            <p className="text-sm text-ink-muted">
              {t.path.lockedUnitSummary(unit.skills.length, number - 1)}
            </p>
          </div>
        </header>
      </section>
    );
  }

  const lockedReason = (skillUnlocked: boolean) =>
    !state.unlocked
      ? t.path.lockedReasonUnit(number - 1)
      : !skillUnlocked
        ? t.path.lockedReasonSkill
        : t.path.lockedReasonLesson;

  return (
    <section
      aria-labelledby={headingId}
      className="mb-10 scroll-mt-[calc(var(--notice-h,0px)+var(--path-header-h,4.5rem))]"
    >
      <header className={`mb-6 rounded-card px-5 py-4 shadow-sm ${theme.band}`}>
        <p className="text-sm font-bold tracking-wide uppercase">{t.path.unit(number)}</p>
        <h2 id={headingId} className="text-2xl font-semibold">
          {unit.title}
        </h2>
      </header>

      {unit.skills.map((skill, k) => {
        const skillState = state.skills[k];
        if (!skillState) return null;
        const total = skillState.nodes.length;
        const crownKind = skillState.nodes.every((n) => n.testedOut) ? 'silver' : 'gold';
        return (
          <div key={skill.id} className="mb-8">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-xl font-semibold">
                <span aria-hidden="true">{skill.icon}</span>
                {skill.title}
              </h3>
              <Link
                to={paths.tip(skill.id)}
                aria-label={t.path.tipFor(skill.title)}
                // Tips are readable even for locked skills, so the link looks the same everywhere.
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-line-strong bg-surface px-4 font-bold text-ink hover:bg-surface-2"
              >
                <BulbIcon />
                {t.path.tip}
              </Link>
            </div>
            <ol className="flex flex-col items-center gap-5">
              {skillState.nodes.map((node, i) => {
                const lesson = skill.lessons[i];
                const isLast = i === total - 1;
                const crown = isLast && skillState.crowned ? crownKind : null;
                const extra = node.testedOut
                  ? t.path.testedOut
                  : crown
                    ? t.path.crowned
                    : undefined;
                return (
                  <PathNode
                    key={node.lessonId}
                    node={node}
                    label={t.path.lessonLabel(
                      i + 1,
                      total,
                      lesson?.title ?? skill.title,
                      node.status === 'locked'
                        ? `${t.path.status.locked} — ${lockedReason(skillState.unlocked)}`
                        : t.path.status[node.status],
                      extra,
                    )}
                    theme={theme}
                    offsetClass={windingOffset(step++)}
                    crown={crown}
                    reduceMotion={reduceMotion}
                    onLockedPress={onLockedPress}
                    nodeRef={refFor(node)}
                  />
                );
              })}
            </ol>
          </div>
        );
      })}

      <ol className="flex flex-col items-center">
        <PathNode
          node={state.review}
          label={t.path.reviewLabel(number, t.path.status[state.review.status], unit.skills.length)}
          theme={theme}
          offsetClass=""
          crown={null}
          reduceMotion={reduceMotion}
          onLockedPress={onLockedPress}
          nodeRef={refFor(state.review)}
        />
      </ol>
    </section>
  );
}
