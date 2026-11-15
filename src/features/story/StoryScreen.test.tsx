import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { t } from '../../i18n/pt-BR';
import { SCENE_MS, StoryScreen } from './StoryScreen';
import { SCENE_COUNT } from './StoryStage';

const renderStory = () =>
  render(
    <MemoryRouter>
      <StoryScreen />
    </MemoryRouter>,
  );

const sceneText = (i: number) => t.story.scenes[i]?.text ?? '';
const button = (name: string) => screen.getByRole('button', { name });

describe('StoryScreen', () => {
  afterEach(() => vi.useRealTimers());

  it('has copy for every scene', () => {
    expect(t.story.scenes).toHaveLength(SCENE_COUNT);
  });

  it('opens paused on the first scene, with a described picture', () => {
    renderStory();
    expect(screen.getByRole('heading', { level: 1, name: t.story.title })).toBeInTheDocument();
    expect(screen.getByText(sceneText(0))).toBeInTheDocument();
    expect(screen.getByRole('img', { name: t.story.scenes[0]?.alt })).toBeInTheDocument();
    expect(button(t.story.play)).toBeInTheDocument();
    expect(button(t.story.prev)).toBeDisabled();
  });

  it('steps through the scenes by hand', () => {
    renderStory();
    fireEvent.click(button(t.story.next));
    expect(screen.getByText(sceneText(1))).toBeInTheDocument();
    expect(screen.getByText(t.story.sceneCount(2, SCENE_COUNT))).toBeInTheDocument();
    fireEvent.click(button(t.story.prev));
    expect(screen.getByText(sceneText(0))).toBeInTheDocument();
  });

  it('plays to the end by itself, then offers to watch again', () => {
    vi.useFakeTimers();
    renderStory();
    fireEvent.click(button(t.story.play));
    expect(button(t.story.pause)).toBeInTheDocument();
    for (let i = 1; i < SCENE_COUNT; i++) {
      act(() => void vi.advanceTimersByTime(SCENE_MS));
      expect(screen.getByText(sceneText(i))).toBeInTheDocument();
    }
    act(() => void vi.advanceTimersByTime(SCENE_MS));
    expect(screen.getByText(t.story.end)).toBeInTheDocument();
    expect(button(t.story.next)).toBeDisabled();
    fireEvent.click(button(t.story.replay));
    expect(screen.getByText(sceneText(0))).toBeInTheDocument();
    expect(button(t.story.pause)).toBeInTheDocument();
  });

  it('does not advance while paused', () => {
    vi.useFakeTimers();
    renderStory();
    fireEvent.click(button(t.story.play));
    fireEvent.click(button(t.story.pause));
    act(() => void vi.advanceTimersByTime(SCENE_MS * 2));
    expect(screen.getByText(sceneText(0))).toBeInTheDocument();
  });
});
