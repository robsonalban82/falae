import { useReducedMotion } from 'motion/react';
import { useEffect, useReducer } from 'react';
import { Link } from 'react-router';
import { paths } from '../../app/routes';
import { t } from '../../i18n/pt-BR';
import { Button } from '../../ui/Button';
import { ArrowRightIcon, PauseIcon, PlayIcon } from '../../ui/icons';
import { SCENE_COUNT, StoryStage } from './StoryStage';
import {
  initialPlayback,
  playbackReducer,
  type Playback,
  type PlaybackAction,
} from './storyPlayback';

/** Time each scene stays on screen while playing. */
export const SCENE_MS = 8000;

const reducer = (state: Playback, action: PlaybackAction) =>
  playbackReducer(state, action, SCENE_COUNT);

/** Route /historias/zeca-e-giulia: animated picture story with captions and player controls. */
export function StoryScreen() {
  const reduce = useReducedMotion() ?? false;
  const [{ index, playing, ended }, dispatch] = useReducer(reducer, initialPlayback);
  const scene = t.story.scenes[index];

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => dispatch({ type: 'tick' }), SCENE_MS);
    return () => window.clearTimeout(timer);
  }, [playing, index]);

  if (!scene) return null;
  return (
    <article className="space-y-4">
      <Link
        to={paths.maps}
        className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-full px-3 font-bold text-secondary hover:bg-surface-2"
      >
        <ArrowRightIcon className="rotate-180" />
        {t.story.back}
      </Link>
      <header className="space-y-1">
        <p className="text-ink-muted">{t.story.kicker}</p>
        <h1 className="text-3xl font-semibold">{t.story.title}</h1>
      </header>
      <div className="overflow-hidden rounded-card border-2 border-line-strong bg-surface">
        <StoryStage index={index} label={scene.alt} moving={playing && !reduce} instant={reduce} />
      </div>
      <ol aria-hidden="true" className="flex gap-1.5">
        {t.story.scenes.map((s, i) => (
          <li
            key={s.alt}
            className={`h-2 flex-1 rounded-full ${i <= index ? 'bg-progress-fill' : 'bg-progress-track'}`}
          />
        ))}
      </ol>
      <div aria-live="polite" className="min-h-28 space-y-1 sm:min-h-24">
        <p className="text-sm font-bold text-ink-muted">
          {t.story.sceneCount(index + 1, SCENE_COUNT)}
        </p>
        <p className="text-xl">{scene.text}</p>
        {ended && <p className="font-display text-xl font-semibold">{t.story.end}</p>}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Button
          variant="ghost"
          compact
          disabled={index === 0}
          onClick={() => dispatch({ type: 'prev' })}
        >
          {t.story.prev}
        </Button>
        <Button onClick={() => dispatch({ type: 'toggle' })}>
          {playing ? <PauseIcon /> : <PlayIcon />}
          {ended ? t.story.replay : playing ? t.story.pause : t.story.play}
        </Button>
        <Button
          variant="ghost"
          compact
          disabled={index === SCENE_COUNT - 1}
          onClick={() => dispatch({ type: 'next' })}
        >
          {t.story.next}
        </Button>
      </div>
      {reduce && <p className="text-sm text-ink-muted">{t.story.reducedMotion}</p>}
    </article>
  );
}
