import { useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { paths } from '../../app/routes';
import { getCourseManifest } from '../../content/loader';
import type { CollectionEntry as Entry } from '../../content/schemas/collection';
import type { MapIcon } from '../../content/schemas/mindmap';
import { t } from '../../i18n/pt-BR';
import { stopSpeaking } from '../../services/speech';
import { ContentError } from '../../ui/ContentError';
import { ContentSkeleton } from '../../ui/ContentSkeleton';
import { NotebookIcon } from '../../ui/notebook/NotebookIcon';
import { MapNotFound } from '../mindmap/MapNotFound';
import { useNoVoiceNotice } from '../mindmap/useNoVoiceNotice';
import { CollectionEntry } from './CollectionEntry';
import { useCollection, type CollectionData } from './useCollection';

const link =
  'inline-flex min-h-11 items-center rounded-lg font-bold text-secondary-shade underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus dark:text-secondary';

type Group = { key: string; title?: string; english?: boolean; icon?: MapIcon; entries: Entry[] };

/** Groups by topic (phrases) or base verb (phrasal verbs); everything else is one flat list. */
function groupsOf({ collection }: CollectionData): Group[] {
  const entries = collection.entries ?? [];
  if (collection.kind === 'phrases' && collection.topics) {
    return collection.topics.map((tp) => ({
      key: tp.id,
      title: tp.title,
      icon: tp.icon,
      entries: entries.filter((e) => e.topic === tp.id),
    }));
  }
  if (collection.kind === 'phrasal-verbs') {
    // The schema requires baseVerb on phrasal-verbs entries; '' only satisfies the type.
    const verbs = [...new Set(entries.map((e) => e.baseVerb ?? ''))];
    return verbs.map((v) => ({
      key: v,
      title: v,
      english: true,
      entries: entries.filter((e) => (e.baseVerb ?? '') === v),
    }));
  }
  return [{ key: 'all', entries }];
}

function CollectionView({ data }: { data: CollectionData }) {
  const { collection, lookup } = data;
  const { canSpeak, noticeRef } = useNoVoiceNotice();
  const maps = getCourseManifest().maps;
  const mapLinks = (collection.mapIds ?? []).flatMap((id) => maps.find((m) => m.id === id) ?? []);
  const groups = groupsOf(data).filter((g) => g.entries.some((e) => lookup(e.itemId)));

  return (
    <article className="mx-auto w-full max-w-3xl space-y-5 p-4">
      <Link to={paths.maps} className={link}>
        {t.maps.backToMaps}
      </Link>
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 font-display text-3xl font-semibold">
          <NotebookIcon name={collection.cover.icon} size={32} />
          {collection.title}
        </h1>
        <p className="text-ink-muted">{collection.subtitle}</p>
        {collection.description && <p className="text-ink-muted">{collection.description}</p>}
      </header>
      {mapLinks.length > 0 && (
        <section aria-labelledby="coll-maps" className="space-y-1">
          <h2 id="coll-maps" className="text-lg font-semibold">
            {t.maps.collection.mapsTitle}
          </h2>
          <ul>
            {mapLinks.map((m) => (
              <li key={m.id}>
                <Link to={paths.map(m.id)} className={link}>
                  {m.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {groups.map((g) => (
        <section key={g.key} aria-label={g.title ? undefined : t.maps.collection.entriesLabel}>
          {g.title && (
            <h2 className="mb-2 flex items-center gap-2 text-xl font-semibold">
              {g.icon && <NotebookIcon name={g.icon} size={24} />}
              {g.english ? <span lang="en">{g.title}</span> : g.title}
            </h2>
          )}
          <ul className="space-y-2">
            {g.entries.map((e) => {
              const item = lookup(e.itemId);
              return item ? <CollectionEntry key={e.itemId} entry={e} item={item} /> : null;
            })}
          </ul>
        </section>
      ))}
      {/* Single notice, as in the map viewer. */}
      <p
        ref={noticeRef}
        role="status"
        tabIndex={-1}
        className={canSpeak ? 'sr-only' : 'text-sm text-ink-muted'}
      >
        {canSpeak ? '' : t.maps.viewer.noVoice}
      </p>
    </article>
  );
}

/** Route /mapas/colecoes/:collectionId (lazy). Read-only; nothing is saved. */
export function CollectionScreen() {
  const { collectionId = '' } = useParams();
  const result = useCollection(collectionId);
  useEffect(() => stopSpeaking, []);

  switch (result.status) {
    case 'not-found':
      return (
        <MapNotFound
          title={t.maps.collection.notFoundTitle}
          body={t.maps.collection.notFoundBody}
        />
      );
    case 'error':
      return <ContentError onRetry={result.retry} />;
    case 'loading':
      return <ContentSkeleton label={t.maps.collection.loading} />;
    case 'ready':
      return <CollectionView key={collectionId} data={result.data} />;
  }
}
