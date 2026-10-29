import { Fragment, type ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { paths, type PathNotice } from '../../app/routes';
import { findSkillUnit, loadUnit } from '../../content/loader';
import type { Skill } from '../../content/schema';
import { t } from '../../i18n/pt-BR';
import { ttsSupported } from '../../services/speech';
import { En } from '../../ui/En';
import { ArrowRightIcon, CheckIcon, CrossIcon } from '../../ui/icons';
import { ContentError } from '../../ui/ContentError';
import { ContentSkeleton } from '../../ui/ContentSkeleton';
import { useAsync } from '../../ui/useAsync';
import { SpeakerButton } from '../lesson/exercises/SpeakerButton';

type Block = Skill['tip']['blocks'][number];

/** Minimal inline markdown: **bold** only (that is all tips use). */
function inline(md: string): ReactNode {
  return md
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) =>
      part.startsWith('**') && part.endsWith('**') ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      ),
    );
}

function TipBlock({ block, tts }: { block: Block; tts: boolean }) {
  switch (block.kind) {
    case 'text':
      return <p className="text-lg">{inline(block.md)}</p>;
    case 'examples':
      return (
        <ul aria-label={t.tip.examples} className="space-y-2">
          {block.items.map((item) => (
            <li
              key={item.en}
              className="flex items-center gap-3 rounded-card border-2 border-line bg-surface p-3"
            >
              {tts && <SpeakerButton text={item.en} label={`${t.lesson.listen}: ${item.en}`} />}
              <span>
                <En className="block text-lg font-bold">{item.en}</En>
                <span className="text-ink-muted">{item.pt}</span>
              </span>
            </li>
          ))}
        </ul>
      );
    case 'pitfall':
      return (
        <div className="space-y-2 rounded-card border-2 border-line-strong bg-surface p-4">
          <p className="flex items-start gap-2 text-danger">
            <CrossIcon size={22} className="mt-0.5 shrink-0" />
            <span>
              <strong>{t.tip.wrong}: </strong>
              <En className="line-through decoration-2">{block.wrong}</En>
            </span>
          </p>
          <p className="flex items-start gap-2 text-success">
            <CheckIcon size={22} className="mt-0.5 shrink-0" />
            <span>
              <strong>{t.tip.right}: </strong>
              <En>{block.right}</En>
            </span>
          </p>
          <p className="text-ink">
            <strong>{t.tip.why} </strong>
            {inline(block.why)}
          </p>
        </div>
      );
  }
}

/** Route /dica/:skillId — read-only study tip (open even for locked skills). */
export function TipScreen() {
  const { skillId = '' } = useParams();
  const unitId = findSkillUnit(skillId);
  const { state, retry } = useAsync(skillId, async () =>
    unitId ? (await loadUnit(unitId)).skills.find((s) => s.id === skillId) : undefined,
  );
  const notFound = () => {
    const notice: PathNotice = 'tipNotFound';
    return <Navigate to={paths.path} replace state={{ notice }} />;
  };
  if (!unitId) return notFound();
  if (state.status === 'loading') return <ContentSkeleton label={t.tip.loading} />;
  if (state.status === 'error') return <ContentError onRetry={retry} />;
  return state.value ? <TipArticle skill={state.value} /> : notFound();
}

function TipArticle({ skill }: { skill: Skill }) {
  const tts = ttsSupported();
  return (
    <article className="space-y-6">
      <Link
        to={paths.path}
        aria-label={t.tip.back}
        className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-full px-3 font-bold text-secondary hover:bg-surface-2"
      >
        <ArrowRightIcon className="rotate-180" />
        {t.tip.backTop}
      </Link>
      <header className="space-y-1">
        <p className="text-ink-muted">
          <span aria-hidden="true">{skill.icon} </span>
          {t.tip.title(skill.title)}
        </p>
        <h1 className="text-3xl font-semibold" tabIndex={-1} ref={(el) => el?.focus()}>
          {skill.tip.title}
        </h1>
      </header>
      {skill.tip.blocks.map((block, i) => (
        <TipBlock key={i} block={block} tts={tts} />
      ))}
      <Link
        to={paths.path}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-primary px-7 py-3 font-display text-lg font-semibold text-on-primary"
      >
        {t.tip.back}
      </Link>
    </article>
  );
}
