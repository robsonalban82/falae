import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ContentLoadError, getCourseManifest } from '../../content/loader';
import { t } from '../../i18n/pt-BR';
import { MapScreen } from './MapScreen';

HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
  this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
  this.removeAttribute('open');
};

const hoisted = vi.hoisted(() => ({
  tts: true,
  noVoice: false,
  listeners: new Set<() => void>(),
  speak: vi.fn<(text: string) => Promise<void>>(),
  stop: vi.fn(),
  artMissing: false,
  loadMap: null as null | ((id: string) => Promise<unknown>),
}));

vi.mock('../../services/speech', () => ({
  ttsSupported: () => hoisted.tts,
  hasNoVoice: () => hoisted.noVoice,
  subscribeNoVoice: (l: () => void) => {
    hoisted.listeners.add(l);
    return () => hoisted.listeners.delete(l);
  },
  speak: (text: string) => hoisted.speak(text),
  stopSpeaking: () => hoisted.stop(),
}));

vi.mock('./art', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./art')>();
  return {
    ...actual,
    artUrl: (name: string) => (hoisted.artMissing ? undefined : actual.artUrl(name)),
  };
});

vi.mock('../../content/loader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../content/loader')>();
  return {
    ...actual,
    loadMap: vi.fn((id: string) => (hoisted.loadMap ?? actual.loadMap)(id)),
  };
});

import * as loader from '../../content/loader';

function renderMap(id = 'mm-to-be') {
  return render(
    <MemoryRouter initialEntries={[`/mapas/${id}`]}>
      <Routes>
        <Route path="/mapas/:mapId" element={<MapScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  hoisted.tts = true;
  hoisted.noVoice = false;
  hoisted.listeners.clear();
  hoisted.artMissing = false;
  hoisted.loadMap = null;
  hoisted.speak.mockReset().mockResolvedValue();
  hoisted.stop.mockReset();
  vi.mocked(loader.loadMap).mockClear();
});
afterEach(() => vi.restoreAllMocks());

const manifestMap = getCourseManifest().maps.find((m) => m.id === 'mm-to-be');

const LISTEN = new RegExp(`^${t.maps.viewer.listen}`);

describe('MapScreen', () => {
  it('renders mm-to-be with all branches and cards', async () => {
    renderMap();
    expect(
      await screen.findByRole('heading', { level: 1, name: /Verbo to be/ }),
    ).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Verbo to be'));
    const branches = screen
      .getAllByRole('heading', { level: 2 })
      .filter((h) => h.querySelector('button[aria-expanded]'));
    expect(branches).toHaveLength(6);
    expect(document.querySelectorAll('[data-tag]')).toHaveLength(manifestMap?.nodeCount ?? -1);
    // the ribbon announces the card count as text
    expect(within(branches[0] as HTMLElement).getByRole('button')).toHaveAccessibleName(
      /, \d+ cartões?$/,
    );
  });

  it('does not render an <img> for a missing scene and keeps title and lines', async () => {
    hoisted.artMissing = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderMap('mm-in-on-at');
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(document.querySelectorAll('img')).toHaveLength(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Cena "'));
    expect(document.querySelectorAll('[data-tag]').length).toBeGreaterThan(3);
  });

  it('renders scenes as decorative lazy images with a fixed size', async () => {
    renderMap('mm-in-on-at');
    await screen.findByRole('heading', { level: 1 });
    const imgs = Array.from(document.querySelectorAll('img'));
    expect(imgs.length).toBeGreaterThan(0);
    for (const img of imgs) {
      expect(img).toHaveAttribute('alt', '');
      expect(img).toHaveAttribute('aria-hidden', 'true');
      expect(img).toHaveAttribute('loading', 'lazy');
      expect(img).toHaveAttribute('width');
      expect(img).toHaveAttribute('height');
    }
  });

  it('shows "not found" for an unknown id without calling the loader', async () => {
    renderMap('mm-nao-existe');
    expect(await screen.findByText(t.maps.viewer.notFoundTitle)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.maps.backToMaps })).toHaveAttribute('href', '/mapas');
    expect(loader.loadMap).not.toHaveBeenCalled();
  });

  it('offers a retry when the content fails to load', async () => {
    const actual =
      await vi.importActual<typeof import('../../content/loader')>('../../content/loader');
    hoisted.loadMap = () =>
      Promise.reject(new ContentLoadError('mm-to-be', 'missing', 'sem rede', 'map'));
    renderMap();
    const retry = await screen.findByRole('button', { name: t.errors.contentRetry });
    hoisted.loadMap = actual.loadMap;
    await userEvent.click(retry);
    expect(
      await screen.findByRole('heading', { level: 1, name: /Verbo to be/ }),
    ).toBeInTheDocument();
  });

  it('opens and closes a branch with the keyboard', async () => {
    const user = userEvent.setup();
    renderMap();
    await screen.findByRole('heading', { level: 1 });
    const first = screen.getAllByRole('button', { expanded: true })[0] as HTMLElement;
    const panelId = first.getAttribute('aria-controls') ?? '';
    expect(document.getElementById(panelId)).not.toBeNull();
    first.focus();
    await user.keyboard('{Enter}');
    expect(first).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(document.getElementById(panelId)).toBeNull());
    await user.keyboard(' ');
    expect(first).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById(panelId)).not.toBeNull();
  });

  it('closes and opens every branch at once', async () => {
    const user = userEvent.setup();
    renderMap();
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getByRole('button', { name: t.maps.viewer.closeAll }));
    expect(screen.queryAllByRole('button', { expanded: true })).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: t.maps.viewer.openAll }));
    expect(screen.getAllByRole('button', { expanded: true })).toHaveLength(6);
  });

  it('speaks a snippet when tapped and toggles aria-pressed', async () => {
    const user = userEvent.setup();
    let finish: () => void = () => {};
    hoisted.speak.mockImplementation(() => new Promise<void>((r) => (finish = r)));
    renderMap();
    await screen.findByRole('heading', { level: 1 });
    const button = screen.getAllByRole('button', { name: LISTEN })[0] as HTMLElement;
    await user.click(button);
    expect(hoisted.speak).toHaveBeenCalledTimes(1);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    await act(async () => finish());
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('without speech there is no audio button and a single notice', async () => {
    hoisted.tts = false;
    renderMap();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryAllByRole('button', { name: LISTEN })).toHaveLength(0);
    expect(screen.getAllByText(t.maps.viewer.noVoice)).toHaveLength(1);
  });

  it('moves focus to the notice when the voice fails after a click (map)', async () => {
    const user = userEvent.setup();
    renderMap();
    await screen.findByRole('heading', { level: 1 });
    const button = screen.getAllByRole('button', { name: LISTEN })[0] as HTMLElement;
    await user.click(button);
    expect(button).toHaveFocus();
    await act(async () => {
      hoisted.noVoice = true;
      hoisted.listeners.forEach((l) => l());
    });
    expect(screen.queryAllByRole('button', { name: LISTEN })).toHaveLength(0);
    const notice = screen.getByText(t.maps.viewer.noVoice);
    expect(notice).toHaveAttribute('role', 'status');
    expect(notice).toHaveFocus();
  });

  it('keeps focus inside the sheet (Close) when the voice fails there', async () => {
    const user = userEvent.setup();
    renderMap();
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getAllByRole('button', { name: /^Ver detalhes de/ })[0] as HTMLElement);
    const dialog = screen.getByRole('dialog');
    const speakBtn = within(dialog).getAllByRole('button', { pressed: false })[0] as HTMLElement;
    speakBtn.focus();
    await act(async () => {
      hoisted.noVoice = true;
      hoisted.listeners.forEach((l) => l());
    });
    expect(within(dialog).getByRole('button', { name: t.maps.viewer.sheetClose })).toHaveFocus();
  });

  it('stops speaking when leaving the screen', async () => {
    const view = renderMap();
    await screen.findByRole('heading', { level: 1 });
    view.unmount();
    expect(hoisted.stop).toHaveBeenCalled();
  });

  it('opens the detail sheet, traps focus, closes with Esc and returns focus', async () => {
    const user = userEvent.setup();
    renderMap();
    await screen.findByRole('heading', { level: 1 });
    const trigger = screen.getAllByRole('button', { name: /^Ver detalhes de/ })[0] as HTMLElement;
    await user.click(trigger);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByText(t.maps.viewer.sheetPt)).toBeInTheDocument();
    // Tab never leaves the dialog
    for (let i = 0; i < 6; i++) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
    await user.tab({ shift: true });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('marks every English snippet with lang="en"', async () => {
    const actual =
      await vi.importActual<typeof import('../../content/loader')>('../../content/loader');
    const [map, index] = await Promise.all([
      actual.loadMap('mm-to-be'),
      actual.loadItems(manifestMap?.itemIds ?? []),
    ]);
    const { lineView } = await import('../../domain/mindmap/lines');
    for (const withSpeech of [true, false]) {
      hoisted.tts = withSpeech;
      const { unmount } = renderMap();
      await screen.findByRole('heading', { level: 1 });
      const english = Array.from(document.querySelectorAll('[lang="en"]')).map(
        (el) => el.textContent ?? '',
      );
      for (const branch of map.branches)
        for (const node of branch.nodes)
          for (const line of node.lines) {
            const view = lineView(line, node.tag, (id) => index.items.get(id));
            const text =
              view?.kind === 'item'
                ? view.en
                : view?.kind === 'text'
                  ? view.speakText
                  : view?.kind === 'fix'
                    ? view.right
                    : null;
            if (text) expect(english.some((e) => e.includes(text))).toBe(true);
          }
      unmount();
    }
  });
});
