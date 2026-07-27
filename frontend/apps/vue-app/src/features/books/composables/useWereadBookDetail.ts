/**
 * 单本书的详情元信息 fetch + 缓存（简介、出版社、评分等）
 *
 * - bookId 用 getter 传入,响应式变化时自动重新加载
 * - 默认带本地 cache(同 bookId 5min 内不重复请求)
 * - refresh(true) 强制绕过 cache 走远端
 *
 * 这是书架详情浮层的"增强层": 面板的核心内容(标题/作者/封面/进度)
 * 来自书架列表 prop,本 composable 只补充列表里没有的元信息。
 */
import { ref, watch, type Ref } from 'vue';
import { wereadGateway, type WereadBookDetail } from '@/features/books/api';

interface CacheEntry {
  detail: WereadBookDetail;
  fetchedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const _cache = new Map<string, CacheEntry>();

export function useWereadBookDetail(bookId: Ref<string | null>) {
  const detail = ref<WereadBookDetail | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // 当前 in-flight 请求归属的 bookId。请求返回时若 bookId 已变化,
  // 说明用户已经切走了,丢弃这本旧书的响应,避免覆盖新书的数据。
  let activeFetchId: string | null = null;

  async function fetchDetail(refresh = false): Promise<void> {
    const id = bookId.value;
    if (!id) return;

    // 本地 cache 命中且未过期
    if (!refresh) {
      const cached = _cache.get(id);
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        if (activeFetchId !== id) return; // 已经切走,连 cache 也不回填
        detail.value = cached.detail;
        return;
      }
    }

    activeFetchId = id;
    isLoading.value = true;
    error.value = null;
    try {
      const res = await wereadGateway.getBookInfo(id);
      if (activeFetchId !== id) return; // 请求期间已经切走,静默丢弃
      if (res.data) {
        detail.value = res.data;
        _cache.set(id, { detail: res.data, fetchedAt: Date.now() });
      } else {
        error.value = res.message || '加载详情失败';
      }
    } catch (e) {
      if (activeFetchId !== id) return; // 同上
      const msg = e instanceof Error ? e.message : '加载详情失败';
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
          detail.value = cached.detail;
        }
        void fetchDetail(false);
      } else {
        detail.value = null;
        error.value = null;
      }
    },
    { immediate: true },
  );

  return { detail, isLoading, error, fetchDetail };
}
