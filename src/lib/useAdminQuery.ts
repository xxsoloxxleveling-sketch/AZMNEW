import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './authContext';

export interface UseAdminQueryResult<T> {
  data: T | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refetch: (showFullLoading?: boolean) => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

/**
 * Standard hook for all Admin views to execute queries safely with:
 * 1. Automatic wait for authLoading / authentication hydration
 * 2. Window focus & periodic polling sync
 * 3. Graceful error handling (no false empty state on network/auth error)
 */
export function useAdminQuery<T>(
  queryFn: () => Promise<T>,
  deps: React.DependencyList = [],
  options: {
    enabled?: boolean;
    pollIntervalMs?: number;
    initialData?: T | null;
  } = {}
): UseAdminQueryResult<T> {
  const { enabled = true, pollIntervalMs = 15000, initialData = null } = options;
  const { isLoading: authLoading, isAuthenticated } = useAuth();

  const [data, setData] = useState<T | null>(initialData);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;

  const execute = useCallback(
    async (showFullLoading = true) => {
      if (authLoading || !isAuthenticated || !enabled) return;

      if (showFullLoading) setIsLoading(true);
      setIsRefreshing(true);
      setError(null);

      try {
        const result = await queryFnRef.current();
        setData(result);
        setError(null);
      } catch (err: any) {
        console.warn('useAdminQuery fetch warning:', err);
        setError(err instanceof Error ? err : new Error(err?.message || 'Failed to fetch data from live API'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [authLoading, isAuthenticated, enabled]
  );

  useEffect(() => {
    if (!authLoading && isAuthenticated && enabled) {
      execute(true);
    }

    if (!authLoading && isAuthenticated && enabled) {
      const handleFocus = () => execute(false);
      window.addEventListener('focus', handleFocus);

      let interval: NodeJS.Timeout | null = null;
      if (pollIntervalMs > 0) {
        interval = setInterval(() => execute(false), pollIntervalMs);
      }

      return () => {
        window.removeEventListener('focus', handleFocus);
        if (interval) clearInterval(interval);
      };
    }
  }, [authLoading, isAuthenticated, enabled, execute, ...deps]);

  return {
    data,
    isLoading: authLoading || isLoading,
    isRefreshing,
    error,
    refetch: execute,
    setData,
  };
}
