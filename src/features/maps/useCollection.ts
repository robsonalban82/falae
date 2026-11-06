import { getCourseManifest, loadCollections, loadItems } from '../../content/loader';
import type { StudyItem } from '../../content/course';
import type { Collection } from '../../content/schemas/collection';
import { useAsync } from '../../ui/useAsync';

export type CollectionData = {
  collection: Collection;
  /** Item of an entry (undefined = not found; the entry is skipped). */
  lookup: (itemId: string) => StudyItem | undefined;
};

export type UseCollection =
  | { status: 'loading' }
  | { status: 'not-found' }
  | { status: 'error'; retry: () => void }
  | { status: 'ready'; data: CollectionData };

/** Loads a collection and the items of its entries. An id outside the manifest never calls the loader. */
export function useCollection(collectionId: string): UseCollection {
  const known = getCourseManifest().collections.some((c) => c.id === collectionId);
  const { state, retry } = useAsync<CollectionData | null>(collectionId, async () => {
    if (!known) return null;
    const collection = (await loadCollections()).find((c) => c.id === collectionId);
    if (!collection) return null;
    const index = await loadItems((collection.entries ?? []).map((e) => e.itemId));
    return { collection, lookup: (id: string) => index.items.get(id) };
  });
  if (!known) return { status: 'not-found' };
  if (state.status === 'error') return { status: 'error', retry };
  if (state.status === 'ready') {
    return state.value ? { status: 'ready', data: state.value } : { status: 'not-found' };
  }
  return { status: 'loading' };
}
