import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useFishingMapStore } from '@/features/fishing/stores/fishingMapStore';

export function useWeatherData(location: [number, number]) {
  const { liveWeather, forecasts, locationName, loading, error } =
    useFishingMapStore(
      useShallow((s) => ({
        liveWeather: s.liveWeather,
        forecasts: s.forecasts,
        locationName: s.locationName,
        loading: s.weatherLoading,
        error: s.weatherError,
      })),
    );

  const refetch = useCallback(() => {
    void useFishingMapStore.getState().fetchWeatherAndFishing(location);
  }, [location]);

  return { liveWeather, forecasts, locationName, loading, error, refetch };
}
