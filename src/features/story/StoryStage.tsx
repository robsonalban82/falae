import { AnimatePresence, motion } from 'motion/react';
import type { ComponentType } from 'react';
import { BeachFrightScene } from './scenes/BeachFrightScene';
import { BeachSorryScene } from './scenes/BeachSorryScene';
import { BedroomScene } from './scenes/BedroomScene';
import { FarewellScene } from './scenes/FarewellScene';
import { ReefDreamScene } from './scenes/ReefDreamScene';
import { ReunionScene } from './scenes/ReunionScene';
import { SandcastleScene } from './scenes/SandcastleScene';
import type { SceneProps } from './scenes/sceneProps';
import { TwilightScene } from './scenes/TwilightScene';

/** Scenes in story order; the copy in `t.story.scenes` follows the same order. */
const scenes: readonly ComponentType<SceneProps>[] = [
  ReefDreamScene,
  BeachFrightScene,
  BeachSorryScene,
  SandcastleScene,
  BedroomScene,
  TwilightScene,
  FarewellScene,
  ReunionScene,
];

export const SCENE_COUNT = scenes.length;

type Props = {
  index: number;
  /** Text alternative of the current picture. */
  label: string;
  /** Loops run only while playing and without reduced motion. */
  moving: boolean;
  /** Reduced motion: scenes swap without the cross-fade. */
  instant: boolean;
};

/** 16:9 stage that cross-fades between the story scenes. */
export function StoryStage({ index, label, moving, instant }: Props) {
  const Scene = scenes[index];
  if (!Scene) return null;
  return (
    <svg viewBox="0 0 320 180" role="img" aria-label={label} className="block h-auto w-full">
      <AnimatePresence initial={false}>
        <motion.g
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: instant ? 0 : 0.6 }}
        >
          <Scene moving={moving} />
        </motion.g>
      </AnimatePresence>
    </svg>
  );
}
