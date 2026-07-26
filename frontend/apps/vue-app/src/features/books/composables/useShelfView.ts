/**
 * BookShelf 视图状态机。
 *
 * 收纳原 BookShelf.vue 散落的全部页面级派生:
 *   1. 4 个用户偏好 ref (searchQuery / filter / sort / density) + localStorage 持久化
 *   2. 状态分桶 buckets(reading / finished / wishlist) + counts
 *   3. 「你正在读」rail: 最近翻过的前 12 本
 *   4. displayedBooks: filter + search + sort 三段管道
 *   5. 派生 UI: showReadingRail / showRecommendRail / gridClass / noResultMessage
 *
 * 调用方只剩装配:
 *   const { filter, sort, density, counts, displayedBooks, ... } = useShelfView(visibleBooks);
 * 然后在 onMounted 触发 useWereadShelf().fetchBooks() 即可。
 *
 * `searchQuery` 故意不持久化 — 它是会话级状态,刷新即清空符合预期。
 */
import type { WereadUserBook } from '@/features/books/api';
import dayjs from 'dayjs';
import { computed, ref, watch, type Ref } from 'vue';

// ── 类型 ────────────────────────────────────────────────────
export type ShelfFilter = 'all' | 'reading' | 'finished' | 'wishlist';
export type ShelfSort = 'recent' | 'title' | 'author';
export type ShelfDensity = 'compact' | 'standard' | 'list';

// ── 常量 ────────────────────────────────────────────────────
const STORAGE_KEY = 'bookshelf:view-prefs';
const RECENT_RAIL_LIMIT = 12;
const LOCALE = 'zh-Hans-CN';

interface PersistedPrefs {
  filter?: ShelfFilter;
  sort?: ShelfSort;
  density?: ShelfDensity;
}

// ── localStorage 持久化 helpers ─────────────────────────────
function readPersistedPrefs(): PersistedPrefs {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PersistedPrefs;
  } catch {
    return {};
  }
}

function writePersistedPrefs(prefs: PersistedPrefs): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota / privacy mode */
  }
}

// ── sort 工具 ───────────────────────────────────────────────
function sortByTitle(a: WereadUserBook, b: WereadUserBook): number {
  return a.title.localeCompare(b.title, LOCALE);
}

function sortByAuthor(a: WereadUserBook, b: WereadUserBook): number {
  return (a.author || '').localeCompare(b.author || '', LOCALE);
}

/** "recent": isTop 置顶,其余按 readUpdateTime DESC,空排末尾 */
function sortByRecent(a: WereadUserBook, b: WereadUserBook): number {
  if (a.isTop !== b.isTop) return a.isTop ? -1 : 1;
  const ta = a.readUpdateTime ? dayjs(a.readUpdateTime * 1000).valueOf() : 0;
  const tb = b.readUpdateTime ? dayjs(b.readUpdateTime * 1000).valueOf() : 0;
  return tb - ta;
}

const SORTERS: Record<
  ShelfSort,
  (a: WereadUserBook, b: WereadUserBook) => number
> = {
  title: sortByTitle,
  author: sortByAuthor,
  recent: sortByRecent,
};

// ── 主入口 ──────────────────────────────────────────────────
export function useShelfView(visibleBooks: Ref<WereadUserBook[]>) {
  const initial = readPersistedPrefs();

  // ── 4 个用户偏好 ─────────────────────────────────────────
  const searchQuery = ref('');
  const filter = ref<ShelfFilter>(initial.filter ?? 'all');
  const sort = ref<ShelfSort>(initial.sort ?? 'recent');
  const density = ref<ShelfDensity>(initial.density ?? 'standard');

  watch([filter, sort, density], ([f, s, d]) => {
    writePersistedPrefs({ filter: f, sort: s, density: d });
  });

  // ── 状态分桶 ─────────────────────────────────────────────
  const buckets = computed(() => {
    const reading: WereadUserBook[] = [];
    const finished: WereadUserBook[] = [];
    const wishlist: WereadUserBook[] = [];
    for (const b of visibleBooks.value) {
      if (b.finishReading) finished.push(b);
      else if (b.readUpdateTime) reading.push(b);
      else wishlist.push(b);
    }
    return { reading, finished, wishlist };
  });

  const counts = computed(() => ({
    all: visibleBooks.value.length,
    reading: buckets.value.reading.length,
    finished: buckets.value.finished.length,
    wishlist: buckets.value.wishlist.length,
  }));

  // ── 「你正在读」rail 数据 ────────────────────────────────
  const recentReading = computed(() => {
    return [...buckets.value.reading]
      .sort(sortByRecent)
      .slice(0, RECENT_RAIL_LIMIT);
  });

  const showReadingRail = computed(
    () =>
      filter.value === 'all' &&
      searchQuery.value.trim() === '' &&
      recentReading.value.length > 0,
  );

  // ── 推荐 rail 显示条件: filter=all 且非搜索时露出 ───────
  const showRecommendRail = computed(
    () => filter.value === 'all' && searchQuery.value.trim() === '',
  );

  // ── filter + search + sort 管道 ─────────────────────────
  const displayedBooks = computed(() => {
    let list: WereadUserBook[];
    if (filter.value === 'reading') list = buckets.value.reading;
    else if (filter.value === 'finished') list = buckets.value.finished;
    else if (filter.value === 'wishlist') list = buckets.value.wishlist;
    else list = visibleBooks.value;

    const q = searchQuery.value.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q),
      );
    }

    return [...list].sort(SORTERS[sort.value]);
  });

  // ── 派生 UI ─────────────────────────────────────────────
  const gridClass = computed(() => {
    if (density.value === 'compact') {
      return 'grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8';
    }
    return 'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';
  });

  const noResultMessage = computed(() => {
    const q = searchQuery.value.trim();
    if (q) return `没有找到「${q}」相关的书籍`;
    if (filter.value === 'reading') return '当前没有在读的书';
    if (filter.value === 'finished') return '还没有读完的书';
    if (filter.value === 'wishlist') return '没有待读的书';
    return '暂无书籍';
  });

  return {
    // 4 个偏好 (v-model 用)
    searchQuery,
    filter,
    sort,
    density,
    // 派生状态
    buckets,
    counts,
    recentReading,
    showReadingRail,
    showRecommendRail,
    displayedBooks,
    // 派生 UI
    gridClass,
    noResultMessage,
  };
}
