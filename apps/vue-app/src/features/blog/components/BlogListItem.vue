<template>
  <motion.div
    :initial="{ opacity: 0, y: 20 }"
    :whileInView="WHILE_IN_VIEW_FADE_UP"
    :transition="{ type: 'spring', duration: 0.5 }"
  >
    <router-link
      :to="`/blog/${post._id}`"
      class="group block focus-visible:outline-none"
    >
      <article
        :class="[
          '/40 bg-page group-hover:border-accent/30 relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-all duration-500 ease-out',
          'group-hover:-translate-y-0.5',
          isFeatured ? 'sm:p-7' : '',
        ]"
      >
        <!-- Left book-spine accent — scales up on hover -->
        <div
          class="bg-accent absolute top-0 left-0 h-full w-[3px] origin-top scale-y-0 transition-transform duration-500 ease-out group-hover:scale-y-100"
          aria-hidden="true"
        />

        <div :class="['flex gap-5 sm:gap-7', isFeatured ? 'sm:gap-9' : '']">
          <!-- 封面：杂志感 3:4；featured 用 lg，其余 md -->
          <div
            :class="[
              'shrink-0',
              isFeatured ? 'sm:w-56 lg:w-64' : 'w-32 sm:w-44',
            ]"
          >
            <BlogCover
              :cover="post.cover ?? null"
              :title="post.title"
              :seed="post._id ?? post.id ?? post.title"
              :category-name="post.tags?.[0]"
              :size="isFeatured ? 'lg' : 'md'"
            />
          </div>

          <!-- 文字区 -->
          <div class="flex min-w-0 flex-1 flex-col">
            <!-- 顶部元数据：置顶 / 章节章 / 分类 / 日期 -->
            <div
              class="text-muted mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px]"
            >
              <span
                v-if="post.is_pinned"
                class="bg-accent/15 text-ink inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-3 w-3"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"
                  />
                </svg>
                置顶
              </span>
              <span
                v-if="post.tags?.length"
                class="text-ink/70 inline-flex items-center gap-1 font-medium"
              >
                <span class="text-ink/70 font-serif">#</span>
                {{ post.tags![0] }}
              </span>
              <span aria-hidden="true" class="text-border">·</span>
              <time class="tabular-nums" :datetime="post.created_at">
                {{ formatDate(post.created_at) }}
              </time>
            </div>

            <!-- 标题：衬线大字，featured 用 text-3xl -->
            <h2
              :class="[
                'text-ink group-hover:text-ink font-serif leading-snug font-semibold transition-colors duration-300 ease-out',
                isFeatured ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl',
              ]"
              style="text-wrap: balance"
            >
              {{ post.title }}
            </h2>

            <!-- 装饰小线：featured 走「— 篇 —」章回标，普通细线 -->
            <div v-if="isFeatured" class="mt-3 flex items-center gap-2">
              <div class="bg-accent/40 h-px w-8" />
              <span
                class="text-muted font-serif text-[11px] tracking-[0.2em] italic"
                >篇</span
              >
              <div class="bg-accent/40 h-px w-8" />
            </div>
            <div
              v-else
              class="bg-border group-hover:bg-accent/30 my-2.5 h-px w-10 transition-all duration-500 ease-out group-hover:w-16"
              aria-hidden="true"
            />

            <!-- 摘要：featured 多给一行 -->
            <p
              v-if="post.summary"
              :class="[
                'text-ink/75 leading-relaxed',
                isFeatured
                  ? 'mt-1 line-clamp-3 text-sm sm:line-clamp-4 sm:text-[15px]'
                  : 'line-clamp-2 text-sm',
              ]"
            >
              {{ post.summary }}
            </p>
            <p
              v-else
              :class="[
                'text-ink/35 italic',
                isFeatured ? 'mt-1 text-sm' : 'text-xs',
              ]"
            >
              （暂无摘要）
            </p>

            <!-- Footer meta: 阅读时长 / 字数 / 浏览量 -->
            <footer
              class="text-ink/55 mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-4 text-xs"
            >
              <span class="inline-flex items-center gap-1">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="2"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z"
                  />
                </svg>
                <span>{{ readingTimeMinutes }} 分钟</span>
              </span>
              <template v-if="CHAR_COUNT > 0">
                <span aria-hidden="true" class="text-border">·</span>
                <span class="tabular-nums">{{ wordCountText }}</span>
              </template>
              <template v-if="post.views">
                <span aria-hidden="true" class="text-border">·</span>
                <span class="inline-flex items-center gap-1 tabular-nums">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                    />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  {{ post.views }}
                </span>
              </template>
            </footer>
          </div>
        </div>
      </article>
    </router-link>
  </motion.div>
</template>

<script setup lang="ts">
import type { Post } from '@/features/blog/types';
import { formatDate } from '@/lib/dayjs';
import { motion } from 'motion-v';
import { WHILE_IN_VIEW_FADE_UP } from '@/constants';
import { computed } from 'vue';
import BlogCover from './BlogCover.vue';

const props = defineProps<{
  post: Post;
  index?: number;
}>();

// index=0 走 featured（更大封面 + 篇 章回标 + 多一行摘要）
const isFeatured = computed(() => (props.index ?? -1) === 0);

// 中文按字符算阅读时间，约 300 字/分钟；纯 markdown 内容先剥标签
const PLAIN_TEXT = computed(() => {
  const raw = props.post.content || props.post.body || '';
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/[#*_`>\-![\]()~]/g, '')
    .trim();
});

const CHAR_COUNT = computed(() => [...PLAIN_TEXT.value].length);

const wordCountText = computed(() => {
  const n = CHAR_COUNT.value;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k 字`;
  return `${n} 字`;
});

const readingTimeMinutes = computed(() => {
  // 300 字/分钟，最少 1 分钟
  return Math.max(1, Math.round(CHAR_COUNT.value / 300));
});
</script>
