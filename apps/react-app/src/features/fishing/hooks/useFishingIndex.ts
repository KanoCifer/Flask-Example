import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useFishingMapStore } from '@/features/fishing/stores/fishingMapStore';

export function useFishingIndex(location: [number, number]) {
  const { indexData, loading, error } = useFishingMapStore(
    useShallow((s) => ({
      indexData: s.indexData,
      loading: s.indexLoading,
      error: s.indexError,
    })),
  );

  const refetch = useCallback(() => {
    void useFishingMapStore.getState().fetchWeatherAndFishing(location);
  }, [location]);

  return { indexData, loading, error, refetch };
}
