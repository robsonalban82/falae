import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import type { CourseManifest } from '../../content/buildManifest';
import { repository } from '../../data';
import { clock } from '../../services/clock';
import { useMapProgress } from '../../stores/useMapProgress';
import { MapsScreen } from './MapsScreen';

const override = vi.hoisted(() => ({ manifest: null as unknown }));
vi.mock('../../content/loader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../content/loader')>();
  return {
    ...actual,
    getCourseManifest: () => (override.manifest ?? actual.getCourseManifest()) as CourseManifest,
  };
});

function Where() {
  const loc = useLocation();
  return <output data-testid="url">{loc.pathname + loc.search}</output>;
}

function renderMaps(url = '/mapas') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <MapsScreen />
      <Where />
    </MemoryRouter>,
  );
}

const url = () => screen.getByTestId('url').textContent;

beforeEach(async () => {
  override.manifest = null;
  clock.setNow('2026-10-29T12:00:00');
  await repository.resetAll();
  await useMapProgress.getState().load(); // settle the reload that resetAll triggers
  useMapProgress.setState({ loaded: false, failed: false, progress: [] });
});
afterEach(() => {
  clock.reset();
  vi.restoreAllMocks();
});

describe('MapsScreen', () => {
  it('lists every map of the manifest and the shelf', async () => {
    renderMaps();
    expect(await screen.findByRole('link', { name: /Verbo to be/ })).toHaveAttribute(
      'href',
      '/mapas/mm-to-be',
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Mapas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Estante de coleções' })).toBeInTheDocument();
    expect(screen.getAllByRole('link').length).toBeGreaterThanOrEqual(5);
    expect(screen.getByText(/^0 de \d+ mapas estudados$/)).toBeInTheDocument();
  });

  it('shows the "already studied" badge as icon plus text, from seeded progress', async () => {
    vi.spyOn(repository, 'getMapProgress').mockResolvedValue([
      {
        mapId: 'mm-to-be',
        firstStudiedAt: '2026-10-28T10:00:00.000Z',
        lastStudiedDay: '2026-10-28',
        timesStudied: 1,
      },
    ]);
    renderMaps();
    const link = await screen.findByRole('link', { name: /Verbo to be/ });
    expect(await within(link).findByText('Já estudado')).toBeInTheDocument();
    expect(screen.getByText(/^1 de \d+ mapas estudados$/)).toBeInTheDocument();
    const other = screen.getByRole('link', { name: /In, on, at/ });
    expect(within(other).queryByText('Já estudado')).not.toBeInTheDocument();
  });

  it('reads filters from the URL and writes them back', async () => {
    const user = userEvent.setup();
    renderMaps('/mapas?nivel=A2');
    await screen.findByRole('link', { name: /Falsos cognatos/ });
    expect(screen.getByLabelText('Nível')).toHaveValue('A2');
    expect(screen.queryByRole('link', { name: /Verbo to be/ })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Nível'), '');
    expect(url()).toBe('/mapas');
    expect(screen.getByRole('link', { name: /Verbo to be/ })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Tipo'), 'gramatica');
    expect(url()).toBe('/mapas?tipo=gramatica');
    await user.selectOptions(screen.getByLabelText('Estudo'), 'nao');
    expect(url()).toBe('/mapas?tipo=gramatica&estudado=nao');
  });

  it('searches without accents ("voce") and keeps the query in the URL', async () => {
    const user = userEvent.setup();
    renderMaps();
    await screen.findByRole('link', { name: /Verbo to be/ });
    const list = () =>
      screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('/mapas/'));
    const all = list().length;
    await user.type(screen.getByLabelText('Buscar mapa'), 'voce ');
    expect(url()).toBe('/mapas?q=voce');
    expect(screen.getByLabelText('Buscar mapa')).toHaveValue('voce ');
    // A map without "você" left the list (counting only map links, not the shelf).
    expect(list().length).toBeLessThan(all);
    expect(screen.queryByRole('link', { name: /Numbers|Números e horas/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Verbo to be/ })).toBeInTheDocument();
  });

  it('announces the result count, and shows a clear button when nothing matches', async () => {
    const user = userEvent.setup();
    renderMaps('/mapas?q=zzzzqq');
    expect(await screen.findByText('Nenhum mapa com esses filtros.')).toBeInTheDocument();
    const status = screen.getByText('0 mapas');
    expect(status).toHaveAttribute('aria-live', 'polite');
    await user.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(url()).toBe('/mapas');
    expect(screen.getByRole('link', { name: /Verbo to be/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limpar filtros' })).not.toBeInTheDocument();
  });

  it('ignores unknown filter values in the URL', async () => {
    renderMaps('/mapas?nivel=Z9&tipo=foo&unidade=nada');
    expect(await screen.findByRole('link', { name: /Verbo to be/ })).toBeInTheDocument();
    expect(screen.getByLabelText('Nível')).toHaveValue('');
  });

  it('reaches every filter with the keyboard', async () => {
    const user = userEvent.setup();
    renderMaps();
    await screen.findByRole('link', { name: /Verbo to be/ });
    await user.click(screen.getByLabelText('Buscar mapa'));
    await user.tab();
    const summary = screen.getByText('Filtros');
    expect(summary).toHaveFocus();
    await user.click(summary);
    expect(summary.closest('details')).toHaveAttribute('open');
    for (const label of ['Nível', 'Unidade', 'Tipo', 'Estudo']) {
      await user.tab();
      expect(screen.getByLabelText(label)).toHaveFocus();
    }
  });

  it('shows an empty state when the manifest has no maps', async () => {
    const real = (
      await vi.importActual<typeof import('../../content/loader')>('../../content/loader')
    ).getCourseManifest();
    override.manifest = { ...real, maps: [], collections: [] };
    renderMaps();
    expect(
      await screen.findByText('Ainda não há mapas por aqui. Volte em breve!'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Estante de coleções' })).not.toBeInTheDocument();
  });

  it('still lists the maps (without badges) when progress cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(repository, 'getMapProgress').mockRejectedValue(new Error('boom'));
    renderMaps();
    expect(await screen.findByRole('link', { name: /Verbo to be/ })).toBeInTheDocument();
    expect(await screen.findByText(/Não deu para ler seu progresso/)).toBeInTheDocument();
    expect(screen.queryByText('Já estudado')).not.toBeInTheDocument();
  });

  it('opens the filters disclosure by itself when the URL has a filter', async () => {
    renderMaps('/mapas?tipo=gramatica');
    const summary = await screen.findByText('Filtros (1 ativo)');
    expect(summary.closest('details')).toHaveAttribute('open');
  });

  it('keeps the filters closed without a filter, and the search always visible', async () => {
    renderMaps('/mapas?q=to');
    const summary = await screen.findByText('Filtros');
    expect(summary.closest('details')).not.toHaveAttribute('open');
    expect(screen.getByLabelText('Buscar mapa')).toBeVisible();
  });

  it('hides the "Estudo" filter when progress cannot be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(repository, 'getMapProgress').mockRejectedValue(new Error('boom'));
    renderMaps('/mapas?estudado=sim');
    await screen.findByText(/Não deu para ler seu progresso/);
    expect(screen.queryByLabelText('Estudo')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Verbo to be/ })).toBeInTheDocument();
  });
});
