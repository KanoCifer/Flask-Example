import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useVisitorCountStore = defineStore('visitorCount', () => {
  const count = ref(0);
  const isConnected = ref(false);
  const visitorId = ref<string | null>(null);

  function setCount(newCount: number) {
    count.value = newCount;
  }

  function setConnected(connected: boolean) {
    isConnected.value = connected;
  }

  const setVisitorId = (id: string | null) => {
    visitorId.value = id;
  };

  return {
    count,
    isConnected,
    visitorId,
    setCount,
    setConnected,
    setVisitorId,
  };
});
