import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hideableChunks } from '../../domain/mindmap/reveal';
import { t } from '../../i18n/pt-BR';
import { HideContext, type HideChunks } from './hideContext';
import { HideEnglishBar } from './HideEnglishBar';
import { LineDetailSheet } from './LineDetailSheet';
import { MapBranch } from './MapBranch';
import { MapHeader } from './MapHeader';
import { MapStudyComplete } from './MapStudyComplete';
import { MapToolbar } from './MapToolbar';
import { useCanSpeak } from './useCanSpeak';
import type { MapData } from './useMap';
import { useMapStudy } from './useMapStudy';

/** A loaded map: header, toolbar, collapsible branches, detail sheet and the single no-voice notice. */
export function MapView({ data }: { data: MapData }) {
  const { map, lookup } = data;
  const canSpeak = useCanSpeak();
  const [open, setOpen] = useState<boolean[]>(() => map.branches.map(() => true));
  const [detail, setDetail] = useState<{ itemId: string; trigger: HTMLElement } | null>(null);
  const allOpen = open.every(Boolean);
  const item = detail ? lookup(detail.itemId) : undefined;
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const wasSpeaking = useRef(canSpeak);
  const chunks = useMemo(() => hideableChunks(map, lookup), [map, lookup]);
  const study = useMapStudy(map.id, chunks);
  const { state } = study;
  const { on, revealed, ratings } = state;
  const revealedSet = useMemo(() => new Set(revealed), [revealed]);
  const { locked, reveal, rate } = study;
  // Stable between renders that change nothing here, so memoized cards stay put.
  const hide = useMemo<HideChunks>(
    () => ({
      on,
      isRevealed: (key) => revealedSet.has(key),
      rating: (key) => ratings[key],
      locked,
      reveal,
      rate,
    }),
    [on, revealedSet, ratings, locked, reveal, rate],
  );

  const toggleHide = () => {
    // Covered chunks in closed branches would be unreachable: open everything.
    if (!state.on) setOpen(map.branches.map(() => true));
    study.toggle();
  };

  // An id that does not resolve must not leave a dead state behind: warn and ignore the tap.
  const openDetails = useCallback(
    (itemId: string, trigger: HTMLElement) => {
      if (!lookup(itemId)) {
        console.warn(`[falae] Item "${itemId}" não encontrado para os detalhes.`);
        setDetail(null);
        return;
      }
      setDetail({ itemId, trigger });
    },
    [lookup],
  );

  // Speech buttons turn into plain text when the voice fails: move focus to the notice
  // instead of letting it fall to <body> (the open sheet handles its own case first).
  useEffect(() => {
    const lost = wasSpeaking.current && !canSpeak;
    wasSpeaking.current = canSpeak;
    if (!lost) return;
    const active = document.activeElement;
    if (!active || active === document.body) noticeRef.current?.focus();
  }, [canSpeak]);

  return (
    <div className="space-y-6">
      <MapHeader map={map} />
      <MapToolbar allOpen={allOpen} onToggleAll={() => setOpen(open.map(() => !allOpen))}>
        <HideEnglishBar
          on={state.on}
          revealed={revealed.length}
          total={study.total}
          onToggle={toggleHide}
        />
      </MapToolbar>
      <HideContext value={hide}>
        <ul aria-label={t.maps.viewer.branchesLabel} className="space-y-6">
          {map.branches.map((branch, i) => (
            <MapBranch
              key={i}
              branch={branch}
              index={i}
              open={open[i] ?? true}
              onToggle={() => setOpen(open.map((o, j) => (j === i ? !o : o)))}
              lookup={lookup}
              onDetails={openDetails}
            />
          ))}
        </ul>
      </HideContext>
      {study.complete && (
        <MapStudyComplete
          mapId={map.id}
          save={study.save}
          pendingRating={study.pendingRating}
          onFinish={study.finish}
        />
      )}
      {/* Always mounted so the live region announces the text when it appears and can take focus. */}
      <p
        ref={noticeRef}
        role="status"
        tabIndex={-1}
        className={canSpeak ? 'sr-only' : 'text-sm text-ink-muted'}
      >
        {canSpeak ? '' : t.maps.viewer.noVoice}
      </p>
      {detail && item && (
        <LineDetailSheet item={item} returnTo={detail.trigger} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}
