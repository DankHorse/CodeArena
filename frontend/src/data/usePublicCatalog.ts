import { DEMO } from '../api';
import { listPublicEvents } from './events';
import { useCallback, useEffect, useState } from 'react';
import {
  loadPublicCatalog,
  type PublicCatalog,
} from './publicData';

export function usePublicCatalog(eventsOnly = false) {
  const [catalog, setCatalog] = useState<PublicCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      setCatalog(!DEMO && eventsOnly ? { events: await listPublicEvents(), projects: [] } : await loadPublicCatalog());
    } catch (error) {
      setCatalog(null);
      setError(
        error instanceof Error
          ? error.message
          : 'Unable to load public event data.',
      );
    } finally {
      setLoading(false);
    }
  }, [eventsOnly]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { catalog, loading, error, refresh };
}
