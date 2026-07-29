import { fetchRecentEvents } from '@readinglist/api';
import type { EventItem } from '@readinglist/types';
import { onMounted, onUnmounted, ref, type Ref } from 'vue';

export interface UseLogStreamReturn {
  recentEvents: Ref<EventItem[]>;
  refresh: () => Promise<void>;
}

/**
 * 服务事件流（最近 N 条）的获取与轮询管理。
 *
 * 后端当前是普通分页接口而非真正的 SSE/WebSocket，故内部以 30s 轮询
 * 模拟「流」的持续更新语义；未来切到 SSE 时只需替换 loadRecentEvents 内部实现。
 *
 * @param perPage - 每次拉取的事件条数，默认 10
 */
export function useLogStream(perPage = 10): UseLogStreamReturn {
  const recentEvents = ref<EventItem[]>([]);
  let eventsTimer: ReturnType<typeof setInterval> | null = null;

  async function loadRecentEvents() {
    try {
      recentEvents.value = await fetchRecentEvents({ perPage });
    } catch {
      /* silent */
    }
  }

  onMounted(() => {
    loadRecentEvents();
    eventsTimer = setInterval(loadRecentEvents, 30_000);
  });

  onUnmounted(() => {
    if (eventsTimer) clearInterval(eventsTimer);
  });

  async function refresh() {
    await loadRecentEvents();
  }

  return {
    recentEvents,
    refresh,
  };
}
