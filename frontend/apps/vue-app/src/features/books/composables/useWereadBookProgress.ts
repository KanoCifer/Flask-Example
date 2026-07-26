/**
 * 单本书的阅读进度 fetch + 缓存
 *
 * - bookId 用 getter 传入,这样监听响应式变化时不需要手写 watch
 * - 默认带本地 cache(同 bookId 30s 内不重复请求)
 * - refresh(true) 强制绕过 cache 走远端
 */
import { ref, watch, type Ref } from 'vue';
import { wereadGateway, type WereadBookProgress } from '@/features/books/api';

interface CacheEntry {
  progress: WereadBookProgress;
  fetchedAt: number;
}

const CACHE_TTL_MS = 30_000;
const _cache = new Map<string, CacheEntry>();

export function useWereadBookProgress(bookId: Ref<string | null>) {
  const progress = ref<WereadBookProgress | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // 当前 in-flight 请求归属的 bookId。请求返回时若 bookId 已变化,
  // 说明用户已经切走了,丢弃这本旧书的响应,避免覆盖新书的数据。
  let activeFetchId: string | null = null;

  async function fetchProgress(refresh = false): Promise<void> {
    const id = bookId.value;
    if (!id) return;

    // 本地 cache 命中且未过期
    if (!refresh) {
      const cached = _cache.get(id);
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        if (activeFetchId !== id) return; // 已经切走,连 cache 也不回填
        progress.value = cached.progress;
        return;
      }
    }

    activeFetchId = id;
    isLoading.value = true;
    error.value = null;
    try {
      const res = await wereadGateway.getBookProgress(id, refresh);
      if (activeFetchId !== id) return; // 请求期间已经切走,静默丢弃
      if (res.data) {
        progress.value = res.data;
        _cache.set(id, { progress: res.data, fetchedAt: Date.now() });
      } else {
        error.value = res.message || '加载进度失败';
      }
    } catch (e) {
      if (activeFetchId !== id) return; // 同上
      const msg = e instanceof Error ? e.message : '加载进度失败';
      error.value = msg;
    } finally {
      if (activeFetchId === id) isLoading.value = false;
    }
  }

  // 监听 bookId 变化,自动重新加载
  watch(
    bookId,
    (id) => {
      if (id) {
        // 先尝试 cache,再静默 fetch
        const cached = _cache.get(id);
        if (cached) {
          progress.value = cached.progress;
        }
        void fetchProgress(false);
      } else {
        progress.value = null;
        error.value = null;
      }
    },
    { immediate: true },
  );

  return { progress, isLoading, error, fetchProgress };
}
