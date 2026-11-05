import { useEffect } from 'react';
import { useParams } from 'react-router';
import { t } from '../../i18n/pt-BR';
import { stopSpeaking } from '../../services/speech';
import { ContentError } from '../../ui/ContentError';
import { ContentSkeleton } from '../../ui/ContentSkeleton';
import { MapNotFound } from './MapNotFound';
import { MapView } from './MapView';
import { useMap } from './useMap';

/** Route /mapas/:mapId (lazy). The only importer of art.ts, through MapScene. */
export function MapScreen() {
  const { mapId = '' } = useParams();
  const result = useMap(mapId);

  // Leaving the screen silences any snippet still playing.
  useEffect(() => stopSpeaking, []);

  switch (result.status) {
    case 'not-found':
      return <MapNotFound />;
    case 'error':
      return <ContentError onRetry={result.retry} />;
    case 'loading':
      return <ContentSkeleton label={t.maps.viewer.loading} />;
    case 'ready':
      return <MapView key={mapId} data={result.data} />;
  }
}
