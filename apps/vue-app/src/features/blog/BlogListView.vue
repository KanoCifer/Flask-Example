<template>
  <BasicDetail
    :title="heroTitle"
    :subtitle="heroSubtitle"
    :onBack="() => $router.push('/')"
  >
    <div class="col-span-full container mx-auto min-h-dvh max-w-6xl px-4 py-8">
      <!-- ──────────────────────────────────────────────────────────── -->
      <!--  工具栏：搜索 + 分类 chip + New Post                          -->
      <!-- ──────────────────────────────────────────────────────────── -->
      <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div class="relative w-full sm:max-w-md sm:flex-1">
          <div
            class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
              class="text-muted h-4 w-4"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
          </div>
          <input
            v-model="searchQuery"
            type="search"
            placeholder="在字里行间，寻一句心动…"
            aria-label="搜索文章"
            class="text-ink placeholder:text-muted/70 focus:border-accent focus:ring-accent/20 bg-page w-full rounded-xl border py-3 pr-10 pl-10 font-serif text-sm placeholder:font-serif placeholder:italic focus:ring-2 focus:outline-none"
            @keyup.enter="handleSearch"
          />
          <button
            v-if="searchQuery"
            type="button"
            aria-label="清空搜索"
            class="text-muted hover:text-ink absolute inset-y-0 right-0 flex items-center pr-3"
            @click="clearSearch"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
              class="h-4 w-4"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div class="flex items-center gap-2 sm:ml-auto">
          <!-- 当前分类 chip：章节章 文学风，列表区顶部永久可见 -->
          <button
            v-if="activeTag"
            type="button"
            class="bg-page text-muted hover:bg-surface hover:text-ink inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
            @click="handleResetFilter"
          >
            <span class="text-ink/70 font-serif italic">#</span>
            <span class="font-serif">{{ activeTag }}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
              class="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            <span class="sr-only">清除分类筛选</span>
          </button>
          <UiButton
            variant="default"
            @click="$router.push('/blog/new')"
            size="md"
          >
            写一篇
          </UiButton>
        </div>
      </div>

      <div class="flex flex-col gap-8 lg:flex-row">
        <!-- Main Content -->
        <div class="min-w-0 flex-1">
          <!-- 列表顶部锚点：翻页时滚到这里 -->
          <div id="blog-list-top" aria-hidden="true" />

          <!-- ────────────────────────────────────────────────────── -->
          <!--  卷一 · 章节目录头：未选分类时显示                       -->
          <!-- ────────────────────────────────────────────────────── -->
          <div
            v-if="!activeTag"
            class="mb-6 flex items-end justify-between gap-4 pb-3"
          >
            <div class="flex items-baseline gap-3">
              <span
                class="text-muted font-mono text-[10px] tracking-[0.4em] uppercase"
                >Volume · 壹</span
              >
              <h2
                class="text-ink font-serif text-base font-semibold sm:text-lg"
              >
                近期文章
              </h2>
            </div>
            <div class="text-muted/70 flex items-center gap-1.5">
              <div class="bg-accent/40 h-px w-6" />
              <span class="font-mono text-[10px] tracking-[0.2em] uppercase"
                >Recent</span
              >
            </div>
          </div>

          <!-- ────────────────────────────────────────────────────── -->
          <!--  分类视图头：选中分类时显示                              -->
          <!-- ────────────────────────────────────────────────────── -->
          <div v-else class="mb-6 flex items-end justify-between gap-4 pb-3">
            <div class="flex items-baseline gap-3">
              <span
                class="text-muted font-mono text-[10px] tracking-[0.4em] uppercase"
                >Volume · 壹</span
              >
              <h2
                class="text-ink font-serif text-base font-semibold sm:text-lg"
              >
                <span class="text-ink/70 mr-1">#</span>{{ activeTag }}
              </h2>
            </div>
            <div class="text-muted/70 flex items-center gap-1.5">
              <div class="bg-accent/40 h-px w-6" />
              <span class="font-mono text-[10px] tracking-[0.2em] uppercase"
                >Category</span
              >
            </div>
          </div>

          <!-- 统一空态样式：圆角 / 边框 / 图标尺寸一致，仅文案与动作不同 -->
          <div
            v-if="isLoading"
            role="status"
            aria-live="polite"
            class="bg-page/50 flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-20 text-center"
          >
            <div
              class="border-accent/20 border-t-accent mb-5 h-12 w-12 animate-spin rounded-full border-4"
            ></div>
            <h3 class="text-ink text-base font-semibold">正在翻开新的一页…</h3>
            <p class="text-muted mt-2 font-serif text-sm italic">
              Loading the latest pages
            </p>
          </div>

          <div
            v-else-if="errorMessage"
            role="alert"
            class="border-destructive/30 bg-destructive/5 flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-20 text-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="text-destructive/70 mb-5 h-14 w-14"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <h3 class="text-destructive text-base font-semibold">页面失落了</h3>
            <p class="text-destructive/80 mt-2 max-w-sm text-sm">
              {{ errorMessage }}
            </p>
            <button
              type="button"
              class="bg-destructive hover:bg-destructive/90 focus:ring-ring mt-5 rounded-lg px-4 py-2 text-sm font-medium text-white focus:ring-2 focus:ring-offset-2 focus:outline-none"
              @click="fetchPosts(1)"
            >
              重新翻一页
            </button>
          </div>

          <div
            v-else-if="posts.length === 0"
            class="bg-page/50 flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-20 text-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="text-muted/50 mb-5 h-14 w-14"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z"
              />
            </svg>
            <h3 class="text-ink font-serif text-base font-semibold">
              {{ activeTag ? '此卷尚是空白' : '书页尚待落墨' }}
            </h3>
            <p class="text-muted mt-2 max-w-sm font-serif text-sm italic">
              {{
                activeTag
                  ? '此卷尚无篇章，待你我来添一笔。'
                  : '一切好故事，都从空白的扉页开始。'
              }}
            </p>
            <div class="mt-5 flex items-center gap-2">
              <button
                v-if="activeTag"
                type="button"
                class="text-muted hover:bg-surface hover:text-ink rounded-lg border px-4 py-2 text-sm font-medium"
                @click="handleResetFilter"
              >
                翻看全卷
              </button>
              <router-link
                v-if="user.isAuthenticated"
                to="/blog/new"
                class="bg-accent text-ink hover:bg-accent/90 rounded-lg px-4 py-2 text-sm font-semibold"
              >
                落笔第一篇
              </router-link>
            </div>
          </div>

          <!-- Blog Post List with page transition -->
          <AnimatePresence v-else mode="wait">
            <motion.div
              :key="currentPage"
              :initial="{ opacity: 0, y: 12 }"
              :animate="{ opacity: 1, y: 0 }"
              :exit="{ opacity: 0, y: -12 }"
              :transition="EASE_INOUT"
              class="space-y-5"
            >
              <BlogListItem
                v-for="(post, index) in posts"
                :key="post._id"
                :post="post"
                :index="index"
              />
            </motion.div>
          </AnimatePresence>

          <!-- Pagination: 统一算法，gap ≥ 2 时自动插入省略号 -->
          <nav
            v-if="pagination && pagination.pages > 1"
            class="mt-10"
            aria-label="博客分页"
          >
            <ul
              class="/80 bg-page/90 mx-auto inline-flex w-full max-w-full items-center justify-center gap-1 rounded-2xl border p-1.5 shadow-sm backdrop-blur-sm sm:w-fit sm:gap-2"
            >
              <li>
                <button
                  type="button"
                  :disabled="!pagination?.has_prev"
                  :aria-disabled="!pagination?.has_prev"
                  class="focus-visible:ring-ring inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  :class="
                    pagination?.has_prev
                      ? 'text-muted hover:bg-surface hover:text-ink'
                      : 'text-muted/50 cursor-not-allowed'
                  "
                  @click="goToPage(pagination!.prev_num!)"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                    class="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  <span class="hidden sm:inline">上一页</span>
                </button>
              </li>

              <template v-for="(item, i) in pageSegments" :key="`seg-${i}`">
                <li v-if="item === 'ellipsis'">
                  <span
                    class="text-muted/60 px-1 text-sm select-none"
                    aria-hidden="true"
                    >…</span
                  >
                </li>
                <li v-else>
                  <button
                    type="button"
                    :aria-current="
                      item === pagination?.page ? 'page' : undefined
                    "
                    class="focus-visible:ring-ring inline-flex h-9 min-w-9 items-center justify-center rounded-xl px-3 text-sm font-semibold transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    :class="
                      item === pagination?.page
                        ? 'bg-accent text-ink'
                        : 'text-muted hover:bg-surface hover:text-ink'
                    "
                    @click="goToPage(item)"
                  >
                    {{ item }}
                  </button>
                </li>
              </template>

              <li>
                <button
                  type="button"
                  :disabled="!pagination?.has_next"
                  :aria-disabled="!pagination?.has_next"
                  class="focus-visible:ring-ring inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                  :class="
                    pagination?.has_next
                      ? 'text-muted hover:bg-surface hover:text-ink'
                      : 'text-muted/50 cursor-not-allowed'
                  "
                  @click="goToPage(pagination!.next_num!)"
                >
                  <span class="hidden sm:inline">下一页</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                    class="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </li>
            </ul>
          </nav>
        </div>
        <!-- HomeSideBar Style Sidebar -->
        <div class="w-full shrink-0 lg:w-72">
          <div class="sticky top-24 h-fit space-y-6">
            <BentoProfileCard />
            <BentoCalendar />
            <BentoCategory
              @filterPosts="handleFilterPosts"
              @resetFilter="handleResetFilter"
              class="hidden p-2! lg:block"
            />
          </div>
        </div>
      </div>

      <!-- ──────────────────────────────────────────────────────────── -->
      <!--  底部装饰：与 SettingsModal · ka·no·ci·fer 对齐              -->
      <!-- ──────────────────────────────────────────────────────────── -->
      <div
        class="text-muted /50 mt-12 flex items-center justify-between border-t pt-4 font-mono text-[10px] tracking-[0.2em] uppercase"
      >
        <span>Essays · 卷一</span>
        <span class="font-serif tracking-normal normal-case italic"
          >ka·no·ci·fer</span
        >
      </div>
    </div>
  </BasicDetail>
</template>

<script setup lang="ts">
import { BasicDetail } from '@/components';
import { blogGateway } from '@/features/blog/api/blogGateway';
import { useNotificationStore } from '@/stores';
import type { BlogPagination, Post } from '@/features/blog/types';
import { BentoCalendar, BentoProfileCard } from '@/components';
import { useHead } from '@vueuse/head';
import { AnimatePresence, motion } from 'motion-v';
import { EASE_INOUT } from '@/constants';
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BentoCategory from './components/BentoCategory.vue';
import BlogListItem from './components/BlogListItem.vue';
import { Button as UiButton } from '@/components';

const route = useRoute();
const router = useRouter();
const posts = ref<Post[]>([]);
const pagination = ref<BlogPagination | null>(null);
const isLoading = ref(false);
const errorMessage = ref('');
const searchQuery = ref<string>('');

const user = ref({
  isAuthenticated: true,
  id: 1,
  isAdmin: false,
});

const activeTag = ref<string | null>(null);

const currentPage = ref(1);

const parsePageFromQuery = (pageQuery: unknown): number => {
  if (typeof pageQuery !== 'string') {
    return 1;
  }

  const parsedPage = Number.parseInt(pageQuery, 10);
  return Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
};

// 分页段：数字 / 省略号 混合序列
// 1 与最末页始终显示；当前页 ±2 范围显示；其余位置用省略号补齐
const pageSegments = computed<(number | 'ellipsis')[]>(() => {
  if (!pagination.value) return [];
  const total = pagination.value.pages;
  const current = pagination.value.page;
  if (total <= 1) return [1];

  const set = new Set<number>([1, total]);
  for (let i = current - 1; i <= current + 1; i++) {
    if (i >= 1 && i <= total) set.add(i);
  }
  const sorted = [...set].sort((a, b) => a - b);

  const out: (number | 'ellipsis')[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
      out.push('ellipsis');
    }
    out.push(sorted[i]);
  }
  return out;
});

const fetchPosts = async (page: number = 1) => {
  isLoading.value = true;
  errorMessage.value = '';

  try {
    const params: Record<string, string | number> = { page };
    if (route.query.search && typeof route.query.search === 'string') {
      params.search = route.query.search;
      searchQuery.value = route.query.search;
    }

    const res = await blogGateway.getBlogs({
      page,
      search: typeof params.search === 'string' ? params.search : undefined,
    });

    posts.value = res.posts as unknown as Post[];
    pagination.value = res.pagination;
    currentPage.value = page;
  } catch (err: unknown) {
    console.error(err);
    errorMessage.value =
      err instanceof Error ? err.message : '加载文章列表失败，请稍后重试。';
    useNotificationStore().error(errorMessage.value);
  } finally {
    isLoading.value = false;
  }
};

const goToPage = (page: number) => {
  if (page >= 1 && pagination.value && page <= pagination.value.pages) {
    // 保留搜索参数
    const query = {
      ...route.query,
      page: page.toString(),
      search: searchQuery.value || undefined,
    };
    if (!searchQuery.value) {
      delete query.search;
    }
    router.push({ query });
    // 滚到列表顶部锚点，避免从 #main-content 跳屏
    const anchor = document.getElementById('blog-list-top');
    if (anchor) {
      const top = anchor.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }
};

const handleSearch = () => {
  // 搜索时回到第一页
  const query = {
    ...route.query,
    page: '1',
    search: searchQuery.value || undefined,
  };
  if (searchQuery.value) {
    query.search = searchQuery.value;
  } else {
    delete query.search;
  }
  router.push({ query });
};

const clearSearch = () => {
  searchQuery.value = '';
  handleSearch();
};

watch(
  () => [route.query.page, route.query.search, route.query.tag],
  ([pageQuery, searchParam, tagQuery]) => {
    searchQuery.value = typeof searchParam === 'string' ? searchParam : '';

    if (typeof tagQuery === 'string' && tagQuery.length > 0) {
      return;
    }

    const pageNum = parsePageFromQuery(pageQuery);
    fetchPosts(pageNum);
  },
  { immediate: true },
);

// ─────────────────────────────────────────────────────────────────
// 文学手账头部文案：随笔录 / 卷·{标签}
// ─────────────────────────────────────────────────────────────────
const heroTitle = computed(() => {
  return activeTag.value ? `卷·${activeTag.value}` : '随笔录';
});

const heroSubtitle = computed(() => {
  return activeTag.value
    ? `Selected essays tagged "${activeTag.value}"`
    : 'Essays on reading, thinking & quiet days';
});

useHead(() => ({
  title: activeTag.value
    ? `${activeTag.value} - ReadingList 随笔录`
    : 'ReadingList 随笔录 - 阅读 · 思考 · 慢时光',
  meta: [
    {
      name: 'description',
      content: activeTag.value
        ? `阅读 ${activeTag.value} 标签下的所有文章 - 个人阅读心得、技术分享、读书笔记`
        : 'ReadingList 随笔录 - 分享个人阅读心得、技术文章、读书笔记，记录阅读的美好时光',
    },
    {
      name: 'keywords',
      content: activeTag.value
        ? `${activeTag.value}, 博客, 阅读, 技术分享, 读书笔记, ReadingList`
        : '博客, 阅读, 技术分享, 读书笔记, ReadingList, 个人博客, 阅读心得, 随笔',
    },
    {
      property: 'og:title',
      content: activeTag.value
        ? `${activeTag.value} 标签文章 - ReadingList 随笔录`
        : 'ReadingList 随笔录',
    },
    {
      property: 'og:description',
      content: activeTag.value
        ? `探索 ${activeTag.value} 标签下的所有文章`
        : 'ReadingList 随笔录 - 分享个人阅读心得、技术文章、读书笔记',
    },
    {
      property: 'og:type',
      content: 'website',
    },
    {
      name: 'og:url',
      content: activeTag.value
        ? `https://readinglist.example.com/blog?tag=${encodeURIComponent(activeTag.value)}`
        : 'https://readinglist.example.com/blog',
    },
    {
      name: 'twitter:title',
      content: activeTag.value
        ? `${activeTag.value} 标签文章 - ReadingList`
        : 'ReadingList 随笔录',
    },
    {
      name: 'twitter:description',
      content: activeTag.value
        ? `探索 ${activeTag.value} 标签下的所有文章`
        : 'ReadingList 随笔录 - 分享个人阅读心得、技术文章、读书笔记',
    },
  ],
}));

const handleFilterPosts = (filteredPosts: Post[], tagName: string) => {
  posts.value = filteredPosts;
  activeTag.value = tagName;
  searchQuery.value = '';
  pagination.value = null; // 标签过滤结果不分页
  const query = { ...route.query };
  delete query.search;
  router.push({ query });
};

// 重置过滤
const handleResetFilter = () => {
  activeTag.value = null;
  searchQuery.value = '';
  const query = { ...route.query };
  delete query.tag;
  delete query.search;
  router.push({ query });
};
</script>
