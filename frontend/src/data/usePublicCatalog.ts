import { useCallback, useEffect, useState } from 'react';
import {
  loadPublicCatalog,
  type PublicCatalog,
} from './publicData';

export function usePublicCatalog() {
  const [catalog, setCatalog] = useState<PublicCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      setCatalog(await loadPublicCatalog());
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
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { catalog, loading, error, refresh };
}
