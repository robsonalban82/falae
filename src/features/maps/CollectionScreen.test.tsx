import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { getCourseManifest, loadCollections, loadItems } from '../../content/loader';
import { paths } from '../../app/routes';
import { t } from '../../i18n/pt-BR';
import { CollectionShelf } from './CollectionShelf';
import { CollectionScreen } from './CollectionScreen';

const speech = vi.hoisted(() => ({
  can: true,
  noVoice: false,
  listeners: new Set<() => void>(),
  stop: vi.fn(),
}));
vi.mock('../../services/speech', () => ({
  ttsSupported: () => speech.can,
  hasNoVoice: () => speech.noVoice,
  subscribeNoVoice: (l: () => void) => {
    speech.listeners.add(l);
    return () => speech.listeners.delete(l);
  },
  speak: () => Promise.resolve(),
  stopSpeaking: () => speech.stop(),
}));

const fail = vi.hoisted(() => ({ on: false }));
vi.mock('../../content/loader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../content/loader')>();
  return {
    ...actual,
    loadCollections: () => (fail.on ? Promise.reject(new Error('boom')) : actual.loadCollections()),
  };
});

function renderAt(id: string) {
  return render(
    <MemoryRouter initialEntries={[paths.collection(id)]}>
      <Routes>
        <Route path={paths.collection()} element={<CollectionScreen />} />
        <Route path="/mapas/:mapId" element={<p>mapa aberto</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  speech.can = true;
  speech.noVoice = false;
  speech.stop.mockClear();
  fail.on = false;
});

const collections = getCourseManifest().collections;

const entryItems = (root: ParentNode = document) =>
  Array.from(root.querySelectorAll('article section:not([aria-labelledby]) > ul > li'));

test.each(collections.map((c) => [c.id, c.title, c.entryCount] as const))(
  'a coleção %s renderiza todas as entradas',
  async (id, title, count) => {
    renderAt(id);
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    const items = entryItems();
    expect(items).toHaveLength(count);
    expect(screen.getByRole('link', { name: t.maps.backToMaps })).toHaveAttribute('href', '/mapas');
    const collection = (await loadCollections()).find((c) => c.id === id);
    const index = await loadItems((collection?.entries ?? []).map((e) => e.itemId));
    (collection?.entries ?? []).forEach((e, i) => {
      const en = index.items.get(e.itemId)?.en ?? '';
      expect(en).not.toBe('');
      const marked = Array.from(document.querySelectorAll('[lang="en"]')).filter(
        (el) => el.textContent === en,
      );
      expect(marked.length, `${id}#${i}`).toBeGreaterThan(0);
    });
  },
);

test('frases agrupam por tópico', async () => {
  renderAt('frases');
  await screen.findByRole('heading', { level: 1 });
  const topics = (await loadCollections()).find((c) => c.id === 'frases')?.topics ?? [];
  expect(topics.length).toBeGreaterThan(0);
  const h2s = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
  for (const tp of topics) expect(h2s).toContain(tp.title);
});

test('phrasal verbs agrupam por verbo base em inglês', async () => {
  renderAt('phrasal');
  await screen.findByRole('heading', { level: 1 });
  const groups = Array.from(document.querySelectorAll('article h2')).filter(
    (h) => h.id !== 'coll-maps',
  );
  expect(groups.length).toBeGreaterThan(0);
  for (const h of groups) expect(h.querySelector('[lang="en"]')).not.toBeNull();
});

test.each(['expressoes', 'falsos-cognatos'])(
  '%s é uma lista única sem título de grupo',
  async (id) => {
    renderAt(id);
    await screen.findByRole('heading', { level: 1 });
    expect(document.querySelectorAll('article section:not([aria-labelledby]) h2')).toHaveLength(0);
    expect(document.querySelectorAll('article section:not([aria-labelledby])')).toHaveLength(1);
  },
);

test('expressões mostram selo de formalidade com texto e "evite quando"', async () => {
  renderAt('expressoes');
  await screen.findByRole('heading', { level: 1 });
  const seals = screen.getAllByText(/^(Informal|Neutro|Gíria)$/);
  expect(seals.length).toBeGreaterThan(0);
  expect(screen.getAllByText(t.maps.collection.avoidWhen).length).toBeGreaterThan(0);
});

test('falsos cognatos mostram o cuidado', async () => {
  renderAt('falsos-cognatos');
  await screen.findByRole('heading', { level: 1 });
  expect(screen.getAllByText(t.maps.viewer.sheetCaution).length).toBeGreaterThan(0);
});

test('mapas da coleção levam ao visualizador', async () => {
  renderAt('phrasal');
  const section = (
    await screen.findByRole('heading', { name: t.maps.collection.mapsTitle })
  ).closest('section');
  if (!section) throw new Error('maps section missing');
  await userEvent.click(within(section).getByRole('link', { name: /get/i }));
  expect(await screen.findByText('mapa aberto')).toBeInTheDocument();
});

test('coleção desconhecida mostra não encontrada', async () => {
  renderAt('nao-existe');
  expect(
    await screen.findByRole('heading', { name: t.maps.collection.notFoundTitle }),
  ).toBeInTheDocument();
});

test('erro de conteúdo oferece tentar de novo', async () => {
  fail.on = true;
  renderAt('frases');
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  fail.on = false;
  await userEvent.click(screen.getByRole('button', { name: t.errors.contentRetry }));
  expect(await screen.findByRole('heading', { level: 1, name: /./ })).toBeInTheDocument();
});

test('com voz há botões de áudio e sem voz há só um aviso', async () => {
  const { unmount } = renderAt('frases');
  await screen.findByRole('heading', { level: 1 });
  expect(
    screen.getAllByRole('button', { name: new RegExp(t.maps.viewer.listen) }).length,
  ).toBeGreaterThan(0);
  expect(screen.queryByText(t.maps.viewer.noVoice)).toBeNull();
  unmount();
  speech.can = false;
  renderAt('frases');
  await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument());
  expect(screen.queryAllByRole('button', { name: new RegExp(t.maps.viewer.listen) })).toHaveLength(
    0,
  );
  expect(screen.getAllByText(t.maps.viewer.noVoice)).toHaveLength(1);
  expect(document.querySelectorAll('[lang="en"]').length).toBeGreaterThan(0);
});

test('foco vai para o aviso quando a voz falha depois do clique', async () => {
  const user = userEvent.setup();
  renderAt('frases');
  await screen.findByRole('heading', { level: 1 });
  const [button] = screen.getAllByRole('button', {
    name: new RegExp(t.maps.viewer.listen),
  });
  if (!button) throw new Error('no listen button');
  await user.click(button);
  expect(button).toHaveFocus();
  await act(async () => {
    speech.noVoice = true;
    speech.listeners.forEach((l) => l());
  });
  expect(screen.queryAllByRole('button', { name: new RegExp(t.maps.viewer.listen) })).toHaveLength(
    0,
  );
  const notice = screen.getByText(t.maps.viewer.noVoice);
  expect(notice).toHaveAttribute('role', 'status');
  expect(notice).toHaveFocus();
});

test('para a fala ao sair da tela', async () => {
  const view = renderAt('frases');
  await screen.findByRole('heading', { level: 1 });
  view.unmount();
  expect(speech.stop).toHaveBeenCalled();
});

test('a capa de um plano de estudos não vira link', () => {
  const [base] = collections;
  if (!base) throw new Error('no collections');
  const plan = { ...base, id: 'plano', title: 'Plano X', kind: 'study-plan' as const };
  render(
    <MemoryRouter>
      <CollectionShelf collections={[plan]} />
    </MemoryRouter>,
  );
  expect(screen.getByText('Plano X')).toBeInTheDocument();
  expect(screen.queryByRole('link')).toBeNull();
});

test('as capas da estante são links para a coleção', () => {
  render(
    <MemoryRouter>
      <CollectionShelf collections={collections} />
    </MemoryRouter>,
  );
  for (const c of collections) {
    expect(screen.getByRole('link', { name: new RegExp(c.title) })).toHaveAttribute(
      'href',
      paths.collection(c.id),
    );
  }
});
