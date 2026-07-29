<script setup lang="ts">
import { AiCompanion } from '@/features/ai';
import { TwikooComments } from '@/components';
import ArticlePreview from './components/ArticlePreview.vue';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components';
import { DelIcon, EditIcon } from '@/components';
import { Eye, Heart } from '@lucide/vue';
import { blogGateway } from '@readinglist/api';
import { useAuthStore } from '@/features/auth';
import { useOrigin } from '@readinglist/utils';
import { useNotificationStore } from '@/stores';
import type { Post } from '@readinglist/types';
import { useHead } from '@vueuse/head';
import hljs from 'highlight.js/lib/common';
import 'highlight.js/scss/rainbow.scss';
import { marked } from 'marked';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const postId = ref<string>(route.params.id as string);

const post = ref<Post | null>(null);
const isLoading = ref(false);
const errorMessage = ref('');

// 点赞：一次性表态。服务端不做重复判定（匿名），
// 故「是否已赞」由 localStorage 在客户端持久化，避免重复提交。
const isLiked = ref(false);
const likesCount = ref(0);
const isLiking = ref(false);
const LIKED_KEY = (id: string) => `readinglist:liked:${id}`;

const auth = useAuthStore();
const showEditButton = computed(() => !!auth.user?.is_admin);

const fetchPost = async () => {
  if (!postId.value) {
    errorMessage.value = '无效的文章 ID';
    return;
  }

  isLoading.value = true;
  errorMessage.value = '';

  try {
    const res = await blogGateway.getLegacyPost(postId.value);
    post.value = res as unknown as Post;

    likesCount.value = (res as unknown as Post).likes ?? 0;
    isLiked.value = localStorage.getItem(LIKED_KEY(postId.value)) === '1';
  } catch (err: unknown) {
    console.error(err);
    errorMessage.value =
      err instanceof Error ? err.message : '加载文章失败，请稍后重试。';
    useNotificationStore().error(errorMessage.value);
  } finally {
    isLoading.value = false;
  }
};

const handleRetry = () => {
  fetchPost();
};

// 点赞：乐观反馈 + 服务端确认。先禁、再请求，成功后以返回的最新数为准。
// 失败则回滚并提示，用户可重试。
const handleLike = async () => {
  if (!postId.value || isLiked.value || isLiking.value) return;

  isLiking.value = true;
  try {
    const likes = await blogGateway.likePost(postId.value);
    likesCount.value = likes;
    isLiked.value = true;
    localStorage.setItem(LIKED_KEY(postId.value), '1');
    useNotificationStore().success('已标记为喜欢');
  } catch (err: unknown) {
    console.error(err);
    const msg = err instanceof Error ? err.message : '操作失败，请稍后重试';
    useNotificationStore().error(msg);
  } finally {
    isLiking.value = false;
  }
};

// 阅读统计：剥离 markdown 标记后，分别计中文字符与西文词数，
// 按 400 字/分钟（中文）+ 200 词/分钟（西文）估算阅读时长。
// 不编造指标——无正文时返回 1 分钟 / 0 字。
function readingStats(body: string): { minutes: number; count: number } {
  if (!body) return { minutes: 1, count: 0 };
  const plain = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/[#>*_~]/g, ' ')
    .replace(/\s+/g, ' ');
  const cjk = (plain.match(/[一-鿿]/g) || []).length;
  const words = (plain.replace(/[一-鿿]/g, ' ').match(/[A-Za-z0-9]+/g) || [])
    .length;
  const count = cjk + words;
  const minutes = Math.max(1, Math.round(cjk / 400 + words / 200));
  return { minutes, count };
}

const stats = computed(() => readingStats(post.value?.body || ''));

// 顶部阅读进度条：跟随窗口滚动
const readProgress = ref(0);
const updateProgress = () => {
  const el = document.documentElement;
  const max = el.scrollHeight - el.clientHeight;
  readProgress.value = max > 0 ? Math.min(1, el.scrollTop / max) : 0;
};

const handleCopyLink = () => {
  navigator.clipboard
    .writeText(window.location.href)
    .then(() => useNotificationStore().success('链接已复制'))
    .catch(() => useNotificationStore().error('复制失败'));
};

onMounted(() => {
  fetchPost();
  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress);
  updateProgress();
});

watch(
  () => route.params.id,
  (newId): void => {
    if (newId && newId !== postId.value) {
      postId.value = newId as string;
      fetchPost();
    }
  },
);

watch(
  () => post.value?.body,
  async (html): Promise<void> => {
    if (!html) return;
    await nextTick();
    hljs.highlightAll();
    setupCodeCopy();
  },
);

const renderedBody = computed(() => {
  if (!post.value?.body) return '';
  return marked.parse(post.value.body, {
    async: false,
    breaks: false,
  }) as string;
});

// 渲染正文中所有 <img src="...">，非 http(s) 开头的补上前缀
const renderedBodyWithOrigin = computed(() => {
  if (!renderedBody.value) return '';
  return renderedBody.value.replace(
    /<img\s+([^>]*?)src=["']([^"']+)["']([^>]*)>/gi,
    (_match, pre, src, post) => {
      const fixed = useOrigin(src);
      return `<img ${pre}src="${fixed}"${post}>`;
    },
  );
});

useHead(() => {
  const title = post.value
    ? `${post.value.title} - 随笔录`
    : '文章未找到 - 随笔录';
  const desc = post.value
    ? post.value.summary || `阅读 ${post.value.title} 的完整内容`
    : '抱歉，您请求的文章不存在或已被删除';
  const keywords = post.value
    ? [
        post.value.title,
        post.value.author || 'Kurroome',
        post.value.tags?.[0] || '博客',
        '阅读',
        '读书笔记',
        '个人博客',
      ]
        .filter(Boolean)
        .join(', ')
    : '文章未找到, 阅读清单';

  const imageMeta = post.value?.cover
    ? [
        { property: 'og:image', content: post.value.cover },
        { name: 'twitter:image', content: post.value.cover },
      ]
    : [];

  return {
    title,
    meta: [
      { name: 'description', content: desc },
      { name: 'keywords', content: keywords },
      { property: 'og:title', content: post.value?.title ?? '文章未找到' },
      { property: 'og:description', content: desc },
      { property: 'og:type', content: 'article' },
      {
        property: 'og:url',
        content: `https://readinglist.example.com/blog/${postId.value}`,
      },
      {
        property: 'og:article:author',
        content: post.value?.author || 'Kurroome',
      },
      {
        property: 'og:article:published_time',
        content: post.value?.created_at,
      },
      { property: 'og:article:modified_time', content: post.value?.updated_at },
      {
        property: 'og:article:section',
        content: post.value?.tags?.[0] || '博客',
      },
      { name: 'twitter:title', content: post.value?.title ?? '文章未找到' },
      { name: 'twitter:description', content: desc },
      ...imageMeta,
    ],
  };
});

const showDeleteDialog = ref(false);

const confirmDelete = async () => {
  showDeleteDialog.value = false;
  await handleDelete();
};

const handleDelete = async () => {
  try {
    await blogGateway.deleteLegacyPost(postId.value);
    useNotificationStore().success('文章删除成功');
    router.push('/blog');
  } catch (err: unknown) {
    console.error('删除文章失败:', err);
    const errorMsg =
      err instanceof Error ? err.message : '删除文章失败，请稍后重试';
    useNotificationStore().error(errorMsg);
  }
};

let clickHandler: ((event: Event) => void) | undefined;
const setupCodeCopy = () => {
  const contentContainer = document.querySelector('.prose');
  if (!contentContainer) return;

  // Early return: buttons already present — skip re-appending on body re-render
  if (contentContainer.querySelector('.copy-btn')) return;

  if (clickHandler) {
    contentContainer.removeEventListener('click', clickHandler);
  }

  clickHandler = (event: Event) => {
    const target = event.target as HTMLElement;
    if (target.classList.contains('copy-btn')) {
      const codeBlock = target.closest('pre');
      if (codeBlock) {
        const codeElement = codeBlock.querySelector('code');
        if (codeElement) {
          navigator.clipboard
            .writeText(codeElement.textContent ?? '')
            .then(() => {
              useNotificationStore().success('代码已复制到剪贴板');
            })
            .catch(() => {
              useNotificationStore().error('复制失败，请手动复制');
            });
        }
      }
    }
  };

  contentContainer.addEventListener('click', clickHandler);

  contentContainer.querySelectorAll('.copy-btn').forEach((btn) => btn.remove());

  const codeBlocks = contentContainer.querySelectorAll('pre');
  codeBlocks.forEach((block) => {
    block.classList.add('w-full', 'whitespace-pre-wrap');
    const button = document.createElement('button');
    button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy-icon lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
    button.className =
      'copy-btn absolute top-1 w-fit right-3 rounded-lg bg-secondary/90 p-1 text-ink';
    block.style.position = 'relative';
    block.appendChild(button);
  });
};

onUnmounted(() => {
  const contentContainer = document.querySelector('.prose');
  if (contentContainer && clickHandler) {
    contentContainer.removeEventListener('click', clickHandler);
  }
  window.removeEventListener('scroll', updateProgress);
  window.removeEventListener('resize', updateProgress);
});
</script>

<template>
  <div class="blog-post bg-page min-h-screen">
    <!-- 阅读进度条：跟随窗口滚动 -->
    <div
      class="bg-border/50 fixed inset-x-0 top-0 z-30 h-[2px] overflow-hidden"
      aria-hidden="true"
    >
      <div
        class="bg-accent h-full origin-left transition-[width] duration-150 ease-out will-change-[width]"
        :style="{ width: `${readProgress * 100}%` }"
      ></div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="mx-auto max-w-[42rem] px-6 py-16">
      <div class="bg-surface/70 skeleton-pulse mb-8 h-5 w-20 rounded" />
      <div class="bg-surface/70 skeleton-pulse mb-4 h-9 w-4/5 rounded" />
      <div class="bg-surface/70 skeleton-pulse mb-12 h-4 w-2/5 rounded" />
      <div
        class="bg-surface/70 skeleton-pulse aspect-[16/9] w-full rounded-xl"
      />
      <div class="mt-10 space-y-4">
        <div class="bg-surface/70 skeleton-pulse h-4 w-full rounded" />
        <div class="bg-surface/70 skeleton-pulse h-4 w-full rounded" />
        <div class="bg-surface/70 skeleton-pulse h-4 w-5/6 rounded" />
        <div class="bg-surface/70 skeleton-pulse h-4 w-full rounded" />
      </div>
    </div>

    <!-- Error -->
    <div
      v-else-if="errorMessage"
      class="mx-auto h-screen max-w-[42rem] px-6 py-24"
    >
      <div
        class="border-destructive/30 bg-destructive/5 flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="text-destructive mb-4 h-12 w-12"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
        <p class="text-destructive text-lg font-medium">加载失败</p>
        <p class="text-muted mt-1 text-sm">{{ errorMessage }}</p>
        <button
          @click="handleRetry"
          class="bg-destructive/90 hover:bg-destructive mt-4 cursor-pointer rounded-lg px-4 py-2 text-sm font-medium text-white transition-all duration-150 active:scale-[0.96]"
        >
          重试
        </button>
      </div>
    </div>

    <!-- Article -->
    <div v-else-if="post">
      <div class="mx-auto max-w-2xl pt-30"></div>

      <ArticlePreview
        :post-id="post._id"
        :title="post.title"
        :cover="post.cover"
        :author="post.author"
        :tags="post.tags"
        :created-at="post.created_at"
        :updated-at="post.updated_at"
        :minutes="stats.minutes"
        :word-count="stats.count"
        :body-html="renderedBodyWithOrigin"
        :show-ai-card="true"
        @copy-link="handleCopyLink"
      >
        <!-- AI 阅读伴侣：内嵌到正文之前 -->
        <template #ai-companion>
          <AiCompanion
            class="mx-auto max-w-2xl"
            :title="post.title"
            :content="post.body || ''"
          />
        </template>
        <!-- 标题右侧操作（仅管理员） -->
        <template #header-actions>
          <div
            v-if="showEditButton"
            class="flex shrink-0 items-center justify-end gap-2"
          >
            <router-link
              :to="`/blog/${post._id}/edit`"
              class="bg-surface text-ink hover:bg-surface/80 inline-flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-all duration-150 active:scale-[0.96]"
            >
              <EditIcon />
              编辑
            </router-link>
            <button
              @click="showDeleteDialog = true"
              class="bg-destructive/10 text-destructive hover:bg-destructive/15 inline-flex cursor-pointer items-center gap-2 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-all duration-150 active:scale-[0.96]"
            >
              <DelIcon />
              删除
            </button>
          </div>
        </template>

        <!-- Deck 尾部：浏览量 + 点赞 -->
        <template #deck-extras>
          <span
            v-if="post.views != null"
            class="inline-flex items-center gap-1"
          >
            · <Eye class="h-3.5 w-3.5" /> {{ post.views }}
          </span>
          <span v-if="post.likes != null" class="inline-flex items-center">
            ·
            <button
              type="button"
              :aria-label="
                isLiked
                  ? `已喜欢 · 当前 ${likesCount}`
                  : `喜欢 · 当前 ${likesCount}`
              "
              :disabled="isLiked || isLiking"
              class="inline-flex cursor-pointer items-center gap-1 rounded transition-colors duration-150 active:scale-[0.96] disabled:cursor-default"
              :class="isLiked ? 'text-ink' : 'text-muted hover:text-ink'"
              @click="handleLike"
            >
              <Heart
                class="h-3.5 w-3.5 transition-all duration-150"
                :class="isLiked ? 'fill-accent' : ''"
              />
              {{ likesCount }}
            </button>
          </span>
        </template>

        <!-- 署名块之后：复制链接 -->
        <template #footer-extra="{ copyLink }">
          <button
            type="button"
            @click="copyLink"
            class="text-muted hover:text-ink inline-flex cursor-pointer items-center gap-1.5 text-[12px] font-medium tracking-[0.02em] transition-all duration-150 active:scale-[0.96]"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.8"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
              />
            </svg>
            复制链接
          </button>
        </template>
      </ArticlePreview>
    </div>

    <TwikooComments
      v-if="post"
      :path="`/blog/${postId}`"
      class="mx-auto max-w-4xl px-6 pb-24"
    />

    <Teleport to="body">
      <AlertDialog
        :open="showDeleteDialog"
        @update:open="showDeleteDialog = $event"
      >
        <AlertDialogContent class="sm:max-w-[425px]">
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除这篇文章？</AlertDialogTitle>
            <AlertDialogDescription> 此操作无法撤销。 </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              class="bg-destructive hover:bg-destructive/90 text-white"
              @click="confirmDelete"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Teleport>
  </div>
</template>

<style>
.copy-btn::before {
  content: '复制';
  position: absolute;
  bottom: -150%;
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  opacity: 0;
  transition:
    opacity 0.2s cubic-bezier(0.2, 0, 0, 1),
    transform 0.2s cubic-bezier(0.2, 0, 0, 1);
  padding: 4px 8px;
  background: var(--ink);
  color: var(--page);
  border-radius: var(--radius-sm);
  pointer-events: none;
  font-size: 0.875rem;
  white-space: nowrap;
}

.copy-btn:hover::before {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
/* 文章阅读体验由 .prose（base.scss）统一提供。 */

/* —— ① 首段 drop cap：editorial 签名时刻，accent 第 2 次出场 —— */
.prose-body > p:first-of-type::first-letter {
  float: left;
  font-family: ui-serif, Georgia, 'Times New Roman', serif;
  font-size: 3.4em;
  line-height: 0.82;
  font-weight: 600;
  margin: 0.08em 0.12em 0 0;
  color: var(--accent);
}

/* Drop cap rag guard: below 30rem the 3.4em float crushes 1-2 char opening lines */
@media (max-width: 30rem) {
  .prose-body > p:first-of-type::first-letter {
    float: none;
    font-size: 1em;
    font-weight: inherit;
    margin: 0;
    color: inherit;
  }
}

/* —— ④ 章节编号：CSS counter，长文目录感 —— */
.prose-body {
  counter-reset: h2-section;
}
.prose-body h2::before {
  counter-increment: h2-section;
  content: '§ ' counter(h2-section) '  ';
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.62em;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: var(--muted-text);
  vertical-align: 0.18em;
}

/* —— Skeleton pulse —— */
.skeleton-pulse {
  animation: skeleton-pulse 1.8s ease-in-out infinite;
}

.tabular-nums {
  font-variant-numeric: tabular-nums;
}

@keyframes skeleton-pulse {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 0.7;
  }
}
</style>
