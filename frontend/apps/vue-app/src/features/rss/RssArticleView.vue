<script setup lang="ts">
import { rssGateway } from '@readinglist/api';
import { BasicDetail } from '@/components';
import { AiCompanion } from '@/features/ai';
import { useNotificationStore } from '@/stores';
import type { RssArticle } from '@readinglist/types';
import { formatDate } from '@/lib/dayjs';
import { useScroll } from '@vueuse/core';
import DOMPurify from 'dompurify';
import { motion } from 'motion-v';
import { SPRING } from '@/constants';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const article = ref<RssArticle | null>(null);
const isLoading = ref<boolean>(true);
const isToggling = ref<boolean>(false);
const errorMessage = ref<string>('');
const notifier = useNotificationStore();

const { y } = useScroll(window);
const percent = computed(() => {
  if (!article.value) return 0;
  const contentHeight =
    document.documentElement.scrollHeight - window.innerHeight;
  return contentHeight > 0
    ? Math.min(100, Math.round((y.value / contentHeight) * 100))
    : 0;
});

const articleId = computed(() => route.params.id as string);

const subtitle = computed(() => {
  if (!article.value) return '';
  const parts: string[] = [];
  if (article.value.author) parts.push(article.value.author);
  if (article.value.published) parts.push(formatDate(article.value.published));
  return parts.join(' · ');
});

const buildProxyImageUrl = (rawUrl: string): string => {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith('data:')) return trimmed;

  let resolved = trimmed;
  try {
    const base =
      article.value?.link || article.value?.feed_url || window.location.origin;
    resolved = new URL(trimmed, base).toString();
  } catch {
    resolved = trimmed;
  }

  return `/v2/rss/image-proxy?url=${encodeURIComponent(resolved)}`;
};

const rewriteHtmlImageUrls = (html: string): string => {
  if (!html) return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  doc.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src');
    if (src) {
      img.setAttribute('src', buildProxyImageUrl(src));
    }

    const dataSrc = img.getAttribute('data-src');
    if (dataSrc) {
      img.setAttribute('data-src', buildProxyImageUrl(dataSrc));
    }

    const srcset = img.getAttribute('srcset');
    if (srcset) {
      const rewritten = srcset
        .split(',')
        .map((part) => {
          const segment = part.trim();
          if (!segment) return segment;
          const [url, descriptor] = segment.split(/\s+/, 2);
          const proxied = buildProxyImageUrl(url);
          return descriptor ? `${proxied} ${descriptor}` : proxied;
        })
        .join(', ');
      img.setAttribute('srcset', rewritten);
    }
  });

  return doc.body.innerHTML;
};

const safeContent = computed(() => {
  const rawHtml = article.value?.content || article.value?.summary || '';
  const proxiedHtml = rewriteHtmlImageUrls(rawHtml);
  return DOMPurify.sanitize(proxiedHtml);
});

const fetchArticle = async () => {
  if (!articleId.value) return;
  isLoading.value = true;
  errorMessage.value = '';
  try {
    article.value = await rssGateway.getArticle(articleId.value);
  } catch (err: unknown) {
    console.error(err);
    errorMessage.value =
      err instanceof Error
        ? err.message
        : String(err) || '加载文章失败，请稍后重试。';
    notifier.error(errorMessage.value);
  } finally {
    isLoading.value = false;
  }
};

const toggleReadStatus = async () => {
  if (!article.value) return;
  isToggling.value = true;
  const isCurrentlyRead = article.value.is_read;

  try {
    if (isCurrentlyRead) {
      await rssGateway.markArticleUnread(articleId.value);
      article.value.is_read = false;
      notifier.success('已标记为未读');
    } else {
      await rssGateway.markArticleRead(articleId.value);
      article.value.is_read = true;
      notifier.success('已标记为已读');
    }
  } catch (err: unknown) {
    console.error('Toggle read status error:', err);
    notifier.error('操作失败，请重试');
  } finally {
    isToggling.value = false;
  }
};

const handleRetry = () => {
  fetchArticle();
};

onMounted(() => {
  fetchArticle();
});

watch(articleId, () => {
  fetchArticle();
});

watch(
  percent,
  async (newPercent) => {
    if (newPercent === 100 && article.value && !article.value.is_read) {
      try {
        await rssGateway.markArticleRead(articleId.value);
        article.value.is_read = true;
        notifier.success('已读完！');
      } catch {
        notifier.error('自动标记已读失败，请手动点击标记');
      }
    }
  },
  { immediate: false },
);
</script>

<template>
  <BasicDetail :title="article?.title || ''" :subtitle="subtitle">
    <div class="col-span-full mx-auto w-full max-w-4xl">
      <!-- Loading State -->
      <div v-if="isLoading" class="py-12 text-center">
        <div
          class="border-t-accent mx-auto h-8 w-8 animate-spin rounded-full border-2"
        ></div>
        <p class="text-muted mt-2">Loading...</p>
      </div>

      <!-- Error State -->
      <div
        v-else-if="errorMessage"
        class="border-destructive/30 bg-destructive/10 rounded-2xl border p-8 text-center"
      >
        <p class="text-destructive">{{ errorMessage }}</p>
        <button
          @click="handleRetry"
          class="bg-accent text-ink hover:bg-accent/90 mt-4 rounded-full px-6 py-2 text-sm font-medium"
        >
          Retry
        </button>
      </div>

      <!-- Article Content -->
      <template v-else-if="article">
        <!-- Actions -->
        <div class="mb-6 flex justify-end">
          <button
            @click="toggleReadStatus"
            :disabled="isToggling"
            class="inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors"
            :class="
              article.is_read
                ? 'bg-surface text-ink hover:bg-surface'
                : 'bg-accent text-ink hover:bg-accent/90'
            "
          >
            <svg
              v-if="isToggling"
              class="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
              class="h-4 w-4"
            >
              <path
                v-if="article.is_read"
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
              <path
                v-else
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {{ article.is_read ? '标记为未读' : '标记为已读' }}
          </button>
        </div>

        <!-- Article Body -->
        <div class="bg-card overflow-hidden rounded-2xl border shadow-sm">
          <div class="border-b p-8">
            <h1 class="text-ink mb-4 text-3xl leading-tight font-bold">
              {{ article.title }}
            </h1>

            <div class="text-ink flex flex-wrap gap-x-6 gap-y-3 text-sm">
              <div
                v-if="article.author"
                class="flex items-center gap-1.5 font-medium"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  class="h-4 w-4"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                  />
                </svg>
                {{ article.author }}
              </div>

              <div v-if="article.published" class="flex items-center gap-1.5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  class="h-4 w-4"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                  />
                </svg>
                {{ formatDate(article.published) }}
              </div>

              <div class="flex items-center gap-1.5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  class="h-4 w-4"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
                  />
                </svg>
                <span class="max-w-50 truncate" :title="article.feed_url">{{
                  article.feed_url
                }}</span>
              </div>

              <a
                v-if="article.link"
                :href="article.link"
                target="_blank"
                rel="noopener noreferrer"
                class="text-ink hover:text-ink flex items-center gap-1.5 hover:underline"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                  class="h-4 w-4"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                  />
                </svg>
                阅读原文
              </a>
            </div>
          </div>

          <div class="p-8">
            <AiCompanion
              :title="article.title"
              :content="article.content || article.summary || ''"
            />
            <div class="prose prose-lg max-w-none" v-html="safeContent"></div>
          </div>
        </div>
      </template>
    </div>

    <!-- Reading Progress -->
    <motion.div
      v-if="percent > 0"
      :initial="{ opacity: 0, y: 20 }"
      :animate="{ opacity: 1, y: 0 }"
      :transition="SPRING"
      class="bg-accent/15 text-ink fixed right-4 bottom-4 w-2xs rounded-lg px-4 py-2 text-sm opacity-90 shadow-lg"
    >
      {{ percent }}% 阅读进度
      <a-flex vertical gap="small">
        <a-progress :percent="percent" type="line" />
      </a-flex>
    </motion.div>
  </BasicDetail>
</template>

<style scoped>
:deep(.prose img) {
  margin-left: auto;
  margin-right: auto;
}
</style>
