import { getCourseManifest, loadItems, loadMap } from '../../content/loader';
import type { StudyItem } from '../../content/course';
import type { MindMap } from '../../content/schemas/mindmap';
import { useAsync } from '../../ui/useAsync';

export type MapData = {
  map: MindMap;
  /** Item of a `ref` line (undefined = not found; the line is skipped). */
  lookup: (itemId: string) => StudyItem | undefined;
};

export type UseMap =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; retry: () => void }
  | { status: 'ready'; data: MapData };

/**
 * Loads a map and the items it refers to, in parallel. An id outside the manifest never calls the
 * loader. Loader failures (including offline) come back as `error` with a retry.
 */
export function useMap(mapId: string): UseMap {
  const known = getCourseManifest().maps.find((m) => m.id === mapId);
  const { state, retry } = useAsync<MapData | null>(mapId, async () => {
    if (!known) return null;
    const [map, index] = await Promise.all([loadMap(mapId), loadItems(known.itemIds)]);
    return { map, lookup: (id: string) => index.items.get(id) };
  });
  if (!known) return { status: 'not-found' };
  if (state.status === 'error') return { status: 'error', retry };
  if (state.status === 'ready' && state.value) return { status: 'ready', data: state.value };
  return { status: 'loading' };
}
