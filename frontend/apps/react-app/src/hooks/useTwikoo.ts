import { useCallback } from 'react';
import twikoo from 'twikoo';

export function useTwikoo() {
  return useCallback(
    (options: { el: string; path?: string; lang?: string }) => {
      twikoo.init({ ...options, envId: 'https://api.kanocifer.chat/twikoo' });
    },
    [],
  );
}
