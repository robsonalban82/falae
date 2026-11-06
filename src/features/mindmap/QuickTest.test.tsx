import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as loader from '../../content/loader';
import { repository } from '../../data';
import { t } from '../../i18n/pt-BR';
import { useProfile } from '../../stores/useProfile';
import { MapScreen } from './MapScreen';

vi.mock('../../services/speech', () => ({
  ttsSupported: () => true,
  hasNoVoice: () => false,
  subscribeNoVoice: () => () => {},
  speak: () => Promise.resolve(),
  stopSpeaking: () => {},
}));

// Lets a test make the known-words chunk fail to load.
const words = vi.hoisted(() => ({ fail: false, calls: 0 }));
vi.mock('../../content/loader', async (orig) => {
  const actual = await orig<typeof loader>();
  return {
    ...actual,
    loadKnownWords: () =>
      ++words.calls && words.fail ? Promise.reject(new Error('chunk')) : actual.loadKnownWords(),
  };
});

const q = t.maps.viewer.quiz;
const MAP = 'mm-to-be';

async function renderMap(id = MAP) {
  render(
    <MemoryRouter initialEntries={[`/mapas/${id}`]}>
      <Routes>
        <Route path="/mapas/:mapId" element={<MapScreen />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { level: 1 });
}

const field = (n: number) => screen.getByLabelText(new RegExp(`^${q.blank(n)}`));
const type = (n: number, value: string) => fireEvent.change(field(n), { target: { value } });
const checkBtn = (n: number) => screen.getByRole('button', { name: `${q.check}: ${q.blank(n)}` });

afterEach(() => {
  vi.restoreAllMocks();
  words.fail = false;
  words.calls = 0;
});

describe('Quick test', () => {
  it('is a labelled section after the branches, with a focusable heading and English fields', async () => {
    await renderMap();
    const section = screen.getByRole('region', { name: t.maps.viewer.hide.quickTest });
    const heading = screen.getByRole('heading', { level: 2, name: t.maps.viewer.hide.quickTest });
    expect(section).toContainElement(heading);
    expect(heading).toHaveAttribute('tabindex', '-1');
    expect(field(1)).toHaveAttribute('lang', 'en');
    expect(screen.getByText('Eu tenho 30 anos.')).toBeInTheDocument();
  });

  it('the toolbar button moves focus to the title', async () => {
    await renderMap();
    const bar = screen.getByRole('group', { name: t.maps.viewer.toolbarLabel });
    fireEvent.click(within(bar).getByRole('button', { name: t.maps.viewer.hide.quickTest }));
    expect(
      screen.getByRole('heading', { level: 2, name: t.maps.viewer.hide.quickTest }),
    ).toHaveFocus();
  });

  it('marks right, almost and wrong with icon-backed text', async () => {
    await renderMap();
    type(1, 'am');
    fireEvent.click(checkBtn(1));
    expect(await screen.findByText(q.right)).toBeInTheDocument();

    type(2, 'iss');
    fireEvent.click(checkBtn(2));
    expect(await screen.findByText(q.wrong)).toBeInTheDocument();
    expect(field(2)).toHaveAttribute('aria-invalid', 'true');
  });

  it('a typo of a longer word is almost: counts, and shows the right form', async () => {
    await renderMap('mm-falsos-cognatos-1');
    type(2, 'libary');
    fireEvent.click(checkBtn(2));
    expect(await screen.findByText(q.almost)).toBeInTheDocument();
    expect(screen.getByText(q.almost).parentElement).toHaveTextContent(`${q.almost}library`);
    const live = screen.getAllByRole('status').find((s) => s.textContent?.includes('library'))!;
    expect(live).toHaveTextContent(`${q.blank(2)}: ${q.almost} library`);
    expect(within(live).getByText('library')).toHaveAttribute('lang', 'en');
  });

  it('editing a checked blank clears its mark and the announcement', async () => {
    await renderMap();
    type(1, 'am');
    fireEvent.click(checkBtn(1));
    expect(await screen.findByText(q.right)).toBeInTheDocument();
    type(1, 'am ');
    expect(screen.queryByText(q.right)).not.toBeInTheDocument();
    expect(screen.getAllByRole('status').every((s) => !s.textContent?.includes(q.right))).toBe(
      true,
    );
  });

  it('a failed known-words load does not break checking, and the next check tries to load again', async () => {
    words.fail = true;
    await renderMap('mm-falsos-cognatos-1');
    type(2, 'libary');
    fireEvent.click(checkBtn(2));
    // Without the word list the typo tolerance is all that is left: still graded, no crash.
    expect(await screen.findByText(q.almost)).toBeInTheDocument();
    const before = words.calls;
    words.fail = false;
    fireEvent.click(checkBtn(2));
    expect(words.calls).toBeGreaterThan(before);
    expect(await screen.findByText(q.almost)).toBeInTheDocument();
  });

  it('Enter checks the blank and focuses the next one, then "Conferir tudo"', async () => {
    await renderMap();
    type(1, 'am');
    fireEvent.keyDown(field(1), { key: 'Enter' });
    expect(await screen.findByText(q.right)).toBeInTheDocument();
    expect(field(2)).toHaveFocus();
    fireEvent.keyDown(field(5), { key: 'Enter' });
    expect(screen.getByRole('button', { name: q.checkAll })).toHaveFocus();
  });

  it('offers the hide-English tip after typing starts and turns the mode on', async () => {
    await renderMap();
    expect(screen.queryByRole('button', { name: q.tip })).not.toBeInTheDocument();
    fireEvent.focus(field(1));
    fireEvent.click(await screen.findByRole('button', { name: q.tip }));
    const toggle = screen.getByRole('button', { name: t.maps.viewer.hide.toggle });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: q.tip })).not.toBeInTheDocument();
    expect(field(1)).toHaveFocus();
  });

  it('writes nothing', async () => {
    const commit = vi.spyOn(useProfile.getState(), 'commitSession');
    const record = vi.spyOn(repository, 'recordLessonResult');
    await renderMap();
    type(1, 'am');
    fireEvent.click(checkBtn(1));
    fireEvent.click(screen.getByRole('button', { name: q.checkAll }));
    fireEvent.click(screen.getByRole('button', { name: q.show }));
    await waitFor(() => expect(screen.getByText(q.right)).toBeInTheDocument());
    expect(commit).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });
});
