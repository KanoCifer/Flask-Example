<script setup lang="ts">
import { ChevronRight } from '@lucide/vue';
import type { WereadUserBook } from '@/features/books/api';
import dayjs from 'dayjs';
import { computed } from 'vue';
import { deterministicCoverGradient } from '../lib/format';

export type BookCardVariant = 'standard' | 'compact' | 'list';

/**
 * 书籍卡片 — 统一版本
 *
 * 三个变体:
 * - `standard`: 网格默认(2-6 列);cover 3:4, 标题 2 行, 有 hover 浮层
 * - `compact`:  网格紧凑(3-8 列);同 standard 但字号更小、内边距更紧
 * - `list`:     横向单行(用于密度切换);封面小, 带"X 天前翻开"状态行
 *
 * 点击统一 emit `select(book)`,由父级决定动作
 * (useWereadBookDetailSingleton 单例、跳转 weread 协议、复制链接等)。
 */
const props = withDefaults(
  defineProps<{
    book: WereadUserBook;
    variant?: BookCardVariant;
    /** 网格 stagger 入场动画的序号;list 变体忽略 */
    index?: number;
    /** 是否显示状态徽标(网格右上 + 列表底部状态行) */
    showStatus?: boolean;
  }>(),
  {
    variant: 'standard',
    index: 0,
    showStatus: true,
  },
);

const emit = defineEmits<{
  select: [book: WereadUserBook];
}>();

const coverGradient = computed(() =>
  deterministicCoverGradient(props.book.bookId),
);

const isList = computed(() => props.variant === 'list');
const isCompact = computed(() => props.variant === 'compact');

/** finished: 已读完;reading: 正在读;none: 待读 */
const readingState = computed<'finished' | 'reading' | 'none'>(() => {
  if (props.book.finishReading) return 'finished';
  if (props.book.readUpdateTime) return 'reading';
  return 'none';
});

const statusLabel = computed(() =>
  readingState.value === 'finished' ? '已读' : '在读',
);

/** 列表变体底部状态行:更细腻的相对时间描述 */
const statusLine = computed(() => {
  if (props.book.finishReading) return '已读完';
  if (!props.book.readUpdateTime) return '尚未翻开';
  const ts = dayjs(props.book.readUpdateTime * 1000);
  if (!ts.isValid()) return '在读';
  const diffD = dayjs().diff(ts, 'day');
  if (diffD === 0) return '今天还在读';
  if (diffD === 1) return '昨天翻开';
  if (diffD < 7) return `${diffD} 天前翻开`;
  if (diffD < 30) return `${Math.floor(diffD / 7)} 周前翻开`;
  return `${ts.format('M/D')} 翻开`;
});

const titleSize = computed(() => (isCompact.value ? 'text-[11px]' : 'text-sm'));
const authorSize = computed(() =>
  isCompact.value ? 'text-[10px]' : 'text-xs',
);

const badgeCls = computed(() =>
  readingState.value === 'finished'
    ? 'bg-success/90 text-ink'
    : 'bg-accent/85 text-ink backdrop-blur-sm',
);

const gridAnimStyle = computed(() => ({
  animationDelay: `${props.index * 30}ms`,
}));

function handleSelect() {
  emit('select', props.book);
}

function onImgError(e: Event) {
  (e.target as HTMLImageElement).style.display = 'none';
}
</script>

<template>
  <button
    type="button"
    class="group focus-visible:ring-ring focus-visible:ring-offset-page block w-full cursor-pointer rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
    @click="handleSelect"
  >
    <!-- ─── List variant: 横向单行 ────────────────────────────── -->
    <div
      v-if="isList"
      class="book-card /60 bg-page hover:bg-surface/40 hover:shadow-accent/5 flex items-center gap-3 rounded-xl border p-3 transition-all duration-300 sm:gap-4 sm:p-4"
      :style="gridAnimStyle"
    >
      <div
        class="bg-surface relative h-16 w-12 flex-shrink-0 overflow-hidden rounded-md shadow-sm sm:h-20 sm:w-14"
      >
        <img
          v-if="book.cover"
          :src="book.cover"
          :alt="book.title"
          class="h-full w-full object-cover"
          loading="lazy"
          @error="onImgError"
        />
        <div
          v-else
          class="flex h-full w-full items-center justify-center"
          :style="{ background: coverGradient }"
        >
          <span class="text-muted/50 font-serif text-base">
            {{ book.title.slice(0, 1) }}
          </span>
        </div>
      </div>
      <div class="min-w-0 flex-1">
        <p
          class="text-ink line-clamp-1 font-serif font-medium"
          :class="titleSize"
          :title="book.title"
        >
          {{ book.title }}
        </p>
        <p
          class="text-muted mt-0.5 line-clamp-1"
          :class="authorSize"
          :title="book.author"
        >
          {{ book.author }}
        </p>
        <p
          v-if="showStatus"
          class="text-muted/80 mt-1 text-[11px] tabular-nums"
        >
          {{ statusLine }}
        </p>
      </div>
      <div class="flex flex-shrink-0 items-center gap-2">
        <span
          v-if="showStatus && readingState !== 'none'"
          class="rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide"
          :class="badgeCls"
        >
          {{ statusLabel }}
        </span>
        <ChevronRight
          class="text-muted/40 h-4 w-4 transition-transform group-hover:translate-x-0.5"
        />
      </div>
    </div>

    <!-- ─── Grid variants: standard / compact ─────────────────── -->
    <div
      v-else
      class="book-card bg-page ring-border/0 group-hover:ring-border/40 group-hover:shadow-accent/10 relative overflow-hidden rounded-xl shadow-sm ring-1 transition-all duration-300 ease-out ring-inset group-hover:-translate-y-1 group-hover:shadow-lg"
      :style="gridAnimStyle"
    >
      <div class="relative aspect-3/4 overflow-hidden">
        <img
          v-if="book.cover"
          :src="book.cover"
          :alt="book.title"
          class="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          loading="lazy"
          decoding="async"
          @error="onImgError"
        />
        <div
          v-else
          class="flex h-full w-full items-center justify-center"
          :style="{ background: coverGradient }"
        >
          <span
            class="text-ink/85 font-serif font-bold drop-shadow-sm"
            :class="isCompact ? 'text-2xl' : 'text-3xl'"
          >
            {{ book.title.slice(0, 1) }}
          </span>
        </div>

        <!-- hover: 自下而上渐变薄纱,只暗化下半部,封面标题仍可读 -->
        <div
          class="from-ink/40 via-ink/10 pointer-events-none absolute inset-0 bg-gradient-to-t to-transparent opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
        />

        <!-- hover: 中央动作按钮(带 scale 弹入) -->
        <div class="absolute inset-0 flex items-center justify-center">
          <div
            class="bg-page/90 text-ink ring-border/50 flex h-9 w-9 scale-90 items-center justify-center rounded-full opacity-0 shadow-md ring-1 backdrop-blur-md transition-all duration-300 ease-out group-hover:scale-100 group-hover:opacity-100"
          >
            <ChevronRight class="h-4 w-4" />
          </div>
        </div>

        <!-- 左上角 slot (rail 用 recency 角标等) -->
        <div v-if="$slots['corner-tl']" class="absolute top-2 left-2 z-10">
          <slot name="corner-tl" />
        </div>

        <!-- 状态徽标(角标) -->
        <span
          v-if="showStatus && readingState !== 'none'"
          class="absolute top-2 right-2 z-10 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide"
          :class="badgeCls"
        >
          {{ statusLabel }}
        </span>
      </div>
      <div :class="isCompact ? 'px-1 py-1.5' : 'px-1.5 py-2'">
        <p
          class="text-ink line-clamp-2 font-serif leading-snug font-medium"
          :class="titleSize"
          :title="book.title"
        >
          {{ book.title }}
        </p>
        <p
          class="text-muted mt-1 truncate leading-snug"
          :class="authorSize"
          :title="book.author"
        >
          {{ book.author }}
        </p>
      </div>
    </div>
  </button>
</template>

<style scoped>
/* 网格 + 列表 stagger 入场:配合 :style="gridAnimStyle" (animationDelay) 使用。
   30ms × index 错峰,>8 项的长尾在 240ms 后几乎同时出现(在视觉上不会察觉)。 */
.book-card {
  animation: book-card-fade 380ms ease-out backwards;
}

@keyframes book-card-fade {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .book-card {
    animation: none;
  }
}
</style>
