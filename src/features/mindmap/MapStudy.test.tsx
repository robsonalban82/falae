import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { getCourseManifest, loadItems, loadMap } from '../../content/loader';
import { hideableChunks, type HideableChunk } from '../../domain/mindmap/reveal';
import { t } from '../../i18n/pt-BR';
import { clock } from '../../services/clock';
import { useProfile, type CommitSummary, type SessionCommit } from '../../stores/useProfile';
import { MapScreen } from './MapScreen';

HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
  this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
  this.removeAttribute('open');
};

vi.mock('../../services/speech', () => ({
  ttsSupported: () => true,
  hasNoVoice: () => false,
  subscribeNoVoice: () => () => {},
  speak: () => Promise.resolve(),
  stopSpeaking: () => {},
}));

const h = t.maps.viewer.hide;
const MAP = 'mm-to-be';
let chunks: HideableChunk[] = [];

const commitSession = vi.fn<(s: SessionCommit, goal: number) => Promise<CommitSummary>>();
const realCommit = useProfile.getState().commitSession;

const summaryOf = (
  s: SessionCommit,
  xp: number,
  patch: Partial<CommitSummary> = {},
): CommitSummary => ({
  result: {
    id: `${s.lessonId}-${s.startedAt}`,
    lessonId: s.lessonId,
    kind: s.kind,
    day: clock.today(),
    finishedAt: clock.iso(),
    xp,
    accuracy: s.summary.accuracy,
    durationMs: s.summary.durationMs,
    mistakes: s.summary.mistakes,
    perfect: false,
    itemOutcomes: s.summary.itemOutcomes,
  },
  streak: null,
  goal: { progress: { xp, goal: 10, met: false, ratio: xp / 10 }, celebrate: false },
  newAchievements: [],
  heartGained: false,
  ...patch,
});

beforeAll(async () => {
  const known = getCourseManifest().maps.find((m) => m.id === MAP);
  const [map, index] = await Promise.all([loadMap(MAP), loadItems(known?.itemIds ?? [])]);
  chunks = hideableChunks(map, (id) => index.items.get(id));
});

beforeEach(() => {
  clock.setNow('2026-10-29T12:00:00');
  commitSession.mockReset().mockImplementation((s) => Promise.resolve(summaryOf(s, 5)));
  useProfile.setState({ commitSession });
});
afterEach(() => {
  clock.reset();
  useProfile.setState({ commitSession: realCommit });
});

async function renderMap() {
  render(
    <MemoryRouter initialEntries={[`/mapas/${MAP}`]}>
      <Routes>
        <Route path="/mapas/:mapId" element={<MapScreen />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { level: 1 });
}

const toggle = () => screen.getByRole('button', { name: h.toggle });
const chunkEl = (key: string) => document.querySelector<HTMLElement>(`[data-chunk="${key}"]`)!;
const peekOf = (key: string) => within(chunkEl(key)).getByRole('button', { name: h.peek });
const progress = () =>
  within(screen.getByRole('group', { name: t.maps.viewer.toolbarLabel })).getByRole('status');

/** Reveals every chunk still covered, ending with `lastKey` (or JSON order). */
async function revealAll(_user: ReturnType<typeof userEvent.setup>, lastKey?: string) {
  const order = lastKey
    ? [...chunks.filter((c) => c.key !== lastKey), ...chunks.filter((c) => c.key === lastKey)]
    : chunks;
  for (const c of order) {
    const peek = within(chunkEl(c.key)).queryByRole('button', { name: h.peek });
    if (peek) fireEvent.click(peek);
  }
}

describe('Hide the English', () => {
  it('is off by default: no post-its, nothing inert, aria-pressed false', async () => {
    await renderMap();
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryAllByRole('button', { name: h.peek })).toHaveLength(0);
    expect(document.querySelectorAll('[inert]')).toHaveLength(0);
  });

  it('turning it on covers every chunk with an inert post-it and shows the progress', async () => {
    const user = userEvent.setup();
    await renderMap();
    await user.click(toggle());
    expect(toggle()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('button', { name: h.peek })).toHaveLength(chunks.length);
    for (const c of chunks) {
      const content = chunkEl(c.key).firstElementChild;
      expect(content).toHaveAttribute('inert');
    }
    // Covered item lines do not offer their details (the label would give the English away).
    expect(screen.queryAllByRole('button', { name: /^Ver detalhes de/ })).toHaveLength(0);
    expect(progress()).toHaveTextContent(h.hint);
    expect(progress()).toHaveTextContent(h.progress(0, chunks.length));
    expect(document.querySelector('img[data-mood="thinking"]')).not.toBeNull();
  });

  it('turning it off removes the post-its', async () => {
    const user = userEvent.setup();
    await renderMap();
    await user.click(toggle());
    await user.click(toggle());
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryAllByRole('button', { name: h.peek })).toHaveLength(0);
  });

  it('opens closed branches when turned on', async () => {
    const user = userEvent.setup();
    await renderMap();
    await user.click(screen.getByRole('button', { name: t.maps.viewer.closeAll }));
    expect(screen.queryAllByRole('button', { expanded: true })).toHaveLength(0);
    await user.click(toggle());
    await waitFor(() =>
      expect(screen.getAllByRole('button', { expanded: true }).length).toBeGreaterThan(0),
    );
    expect(screen.queryAllByRole('button', { expanded: false })).toHaveLength(0);
  });

  it('revealing focuses the revealed chunk and updates the live progress', async () => {
    const user = userEvent.setup();
    await renderMap();
    await user.click(toggle());
    const first = chunks[0]!;
    peekOf(first.key).focus();
    await user.keyboard('{Enter}');
    const content = chunkEl(first.key).firstElementChild as HTMLElement;
    expect(content).not.toHaveAttribute('inert');
    expect(within(chunkEl(first.key)).queryByRole('button', { name: h.peek })).toBeNull();
    // Focus lands on the speak button of the revealed snippet.
    expect(content.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toHaveAccessibleName(/^Ouvir:/);
    expect(progress()).toHaveTextContent(h.progress(1, chunks.length));
  });

  it('a revealed item line offers "Lembrei / Não lembrei" and shows the choice', async () => {
    const user = userEvent.setup();
    await renderMap();
    await user.click(toggle());
    const item = chunks.find((c) => c.itemId)!;
    const li = chunkEl(item.key).closest('li') as HTMLElement;
    expect(within(li).queryByRole('group', { name: h.rateLabel })).toBeNull();
    await user.click(peekOf(item.key));
    const group = within(li).getByRole('group', { name: h.rateLabel });
    await user.click(within(group).getByRole('button', { name: h.forgot }));
    expect(within(li).queryByRole('group', { name: h.rateLabel })).toBeNull();
    const choice = within(li).getByText(h.forgot);
    expect(choice).toHaveFocus();
    // Details come back once the English is visible.
    expect(within(li).getByRole('button', { name: /^Ver detalhes de/ })).toBeInTheDocument();
    // Non-item chunks never offer a rating.
    const text = chunks.find((c) => !c.itemId)!;
    await user.click(peekOf(text.key));
    expect(within(chunkEl(text.key).closest('li') as HTMLElement).queryByRole('group')).toBeNull();
  });

  it('opening, reading and revealing part of the map writes nothing', async () => {
    const user = userEvent.setup();
    await renderMap();
    await user.click(toggle());
    for (const c of chunks.slice(0, 3)) await user.click(peekOf(c.key));
    expect(commitSession).not.toHaveBeenCalled();
  });

  it('turning the mode off before the end writes nothing', async () => {
    const user = userEvent.setup();
    await renderMap();
    await user.click(toggle());
    for (const c of chunks.slice(0, -1)) await user.click(peekOf(c.key));
    await user.click(toggle());
    await user.click(toggle());
    expect(screen.getAllByRole('button', { name: h.peek })).toHaveLength(chunks.length);
    expect(commitSession).not.toHaveBeenCalled();
  });

  it('revealing everything commits one map session and shows "+5 XP" from the commit', async () => {
    const user = userEvent.setup();
    await renderMap();
    await user.click(toggle());
    const last = chunks.findLast((c) => !c.itemId)!;
    const rated = chunks.find((c) => c.itemId)!;
    await user.click(peekOf(rated.key));
    await user.click(
      within(chunkEl(rated.key).closest('li') as HTMLElement).getByRole('button', {
        name: h.remembered,
      }),
    );
    await revealAll(user, last.key);
    const panel = await screen.findByRole('heading', { name: h.title });
    expect(screen.getByText(h.xp(5))).toBeInTheDocument();
    expect(panel.closest('section')).toBe(screen.getByTestId('map-study-complete'));
    expect(screen.getByText(h.xp(5)).closest('[role="status"]')).not.toBeNull();
    expect(screen.getByRole('link', { name: h.practice })).toHaveAttribute(
      'href',
      `/mapas/${MAP}/praticar`,
    );
    expect(progress()).toHaveTextContent(h.allRevealed);
    expect(commitSession).toHaveBeenCalledTimes(1);
    const [session, goal] = commitSession.mock.calls[0]!;
    expect(goal).toBeGreaterThan(0);
    expect(session).toMatchObject({
      lessonId: `map:${MAP}`,
      kind: 'map',
      context: { mapId: MAP },
      startedAt: clock.now(),
      summary: { xp: 5, mistakes: 0, perfect: false },
    });
    expect(session.summary.itemOutcomes).toContainEqual({ itemId: rated.itemId, q: 4 });
    // Ratings are frozen once saved.
    expect(screen.queryAllByRole('group', { name: h.rateLabel })).toHaveLength(0);
  });

  it('shows "sem XP desta vez" when the commit says 0 XP (never recomputed)', async () => {
    commitSession.mockImplementation((s) => Promise.resolve(summaryOf(s, 0)));
    const user = userEvent.setup();
    await renderMap();
    await user.click(toggle());
    await revealAll(user, chunks.findLast((c) => !c.itemId)!.key);
    expect(await screen.findByText(h.noXp)).toBeInTheDocument();
    expect(screen.queryByText(h.xp(5))).toBeNull();
  });

  it('shows the streak and the goal only when they changed', async () => {
    commitSession.mockImplementation((s) =>
      Promise.resolve(
        summaryOf(s, 5, {
          streak: {
            streak: {
              current: 4,
              longest: 4,
              freezes: 0,
              xpTowardFreeze: 0,
              lastActiveDay: clock.today(),
            },
            event: 'continued',
            increased: true,
            freezeUsed: false,
            freezesEarned: 0,
          },
          goal: { progress: { xp: 10, goal: 10, met: true, ratio: 1 }, celebrate: true },
        }),
      ),
    );
    const user = userEvent.setup();
    await renderMap();
    await user.click(toggle());
    await revealAll(user, chunks.findLast((c) => !c.itemId)!.key);
    expect(await screen.findByText(t.header.streak(4))).toBeInTheDocument();
    expect(screen.getByText(t.lesson.complete.goalMetDetail(10, 10))).toBeInTheDocument();
  });

  it('waits for the optional rating of the last item, or "Concluir"', async () => {
    const user = userEvent.setup();
    await renderMap();
    await user.click(toggle());
    const lastItem = chunks.findLast((c) => c.itemId)!;
    await revealAll(user, lastItem.key);
    expect(screen.getByText(h.lastPending)).toBeInTheDocument();
    expect(commitSession).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: h.finish }));
    expect(await screen.findByText(h.xp(5))).toBeInTheDocument();
    expect(commitSession).toHaveBeenCalledTimes(1);
  });

  it('rating the last item commits it with the rating', async () => {
    const user = userEvent.setup();
    await renderMap();
    await user.click(toggle());
    const lastItem = chunks.findLast((c) => c.itemId)!;
    await revealAll(user, lastItem.key);
    await user.click(
      within(chunkEl(lastItem.key).closest('li') as HTMLElement).getByRole('button', {
        name: h.forgot,
      }),
    );
    await screen.findByText(h.xp(5));
    expect(commitSession.mock.calls[0]![0].summary.itemOutcomes).toContainEqual({
      itemId: lastItem.itemId,
      q: 1,
    });
  });

  it('a failed save offers "Tentar de novo" and keeps everything revealed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    commitSession.mockRejectedValueOnce(new Error('disk full'));
    const user = userEvent.setup();
    await renderMap();
    await user.click(toggle());
    await revealAll(user, chunks.findLast((c) => !c.itemId)!.key);
    expect(await screen.findByText(h.saveError)).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: h.peek })).toHaveLength(0);
    expect(toggle()).toHaveAttribute('aria-pressed', 'true');
    await act(async () => {
      await user.click(screen.getByRole('button', { name: t.errors.contentRetry }));
    });
    expect(await screen.findByText(h.xp(5))).toBeInTheDocument();
    expect(commitSession).toHaveBeenCalledTimes(2);
    const [a, b] = commitSession.mock.calls;
    // Same run, same summary: the deterministic id makes the retry safe.
    expect(b![0]).toEqual(a![0]);
  });

  it('a new run after turning off and on gets a new startedAt', async () => {
    const user = userEvent.setup();
    await renderMap();
    await user.click(toggle());
    await revealAll(user, chunks.findLast((c) => !c.itemId)!.key);
    await screen.findByText(h.xp(5));
    await user.click(toggle());
    expect(screen.queryByRole('heading', { name: h.title })).toBeNull();
    await user.click(toggle());
    await revealAll(user, chunks.findLast((c) => !c.itemId)!.key);
    await waitFor(() => expect(commitSession).toHaveBeenCalledTimes(2));
    const [a, b] = commitSession.mock.calls;
    expect(b![0].startedAt).toBeGreaterThan(a![0].startedAt);
  });
});
