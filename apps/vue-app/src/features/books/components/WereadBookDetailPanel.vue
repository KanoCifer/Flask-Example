<script setup lang="ts">
import { computed, watch } from 'vue';
import { BookOpen, Eye, EyeOff, RefreshCw, X } from '@lucide/vue';
import { AnimatePresence, motion } from 'motion-v';
import { FADE_FAST, FADE, SPRING_SNUG, EASE_SLOW } from '@/constants';
import type { WereadBookProgress, WereadUserBook } from '@/features/books/api';
import { useWereadBookProgress } from '../composables/useWereadBookProgress';
import {
  deterministicCoverGradient,
  formatProgressPercent,
} from '../lib/format';
import { formatDuration } from '@/lib/dayjs';
import { formatRelative } from '@/lib/dayjs';

/**
 * 书籍详情浮层 — 点击卡片后的详情面板
 *
 * 关键设计:
 * 1. Teleport 到 body 脱离 grid 的 overflow 限制
 * 2. 背景遮罩 + 面板本体用 motion-v 做 scale / blur 入场
 * 3. 进度 / 统计 / 操作用普通 initial+animate 渐入,delay 错峰
 * 4. 进度数据:可选 props (parent 已加载) 或内部 fetch (bookId 变化时自动)
 * 5. 关闭时 selectedBook 保留到 exit 动画完成再清,避免内容突变
 */

const props = defineProps<{
  book: WereadUserBook | null;
  open: boolean;
  /** 外部已加载的进度,传入则跳过内部 fetch */
  progress?: WereadBookProgress | null;
}>();

const emit = defineEmits<{
  close: [];
  refresh: [bookId: string];
  /** 内部 fetch 完成后抛出,父级可同步到 store */
  progressLoaded: [bookId: string, progress: WereadBookProgress];
}>();

// 内部进度 (bookId 变化时重新加载)
const bookIdRef = computed(() => props.book?.bookId ?? null);
const {
  progress: internalProgress,
  isLoading: progressLoading,
  error: progressError,
  fetchProgress,
} = useWereadBookProgress(bookIdRef);

const liveProgress = computed<WereadBookProgress | null>(
  () => props.progress ?? internalProgress.value,
);

const livePercent = computed(() => {
  const p = liveProgress.value?.progress;
  if (p == null) {
    // 无进度数据时,fallback 到是否读完
    return props.book?.finishReading ? 100 : 0;
  }
  return p;
});

const hasProgress = computed(() => liveProgress.value != null);

// 内部 fetch 完成后,通知父级
watch(internalProgress, (val) => {
  if (val && props.book) {
    emit('progressLoaded', props.book.bookId, val);
  }
});

// 重新打开时:新书 → 重新拉;老书但 stale → 静默
watch(
  () => [props.open, props.book?.bookId] as const,
  ([isOpen, id]) => {
    if (isOpen && id) {
      // 走内部缓存策略,不强制刷新
      void fetchProgress(false);
    }
  },
);

async function handleRefresh(): Promise<void> {
  if (!props.book) return;
  await fetchProgress(true);
  emit('refresh', props.book.bookId);
}

const coverGradient = computed(() =>
  props.book ? deterministicCoverGradient(props.book.bookId) : '',
);
</script>

<template>
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="open && book"
        :key="book.bookId"
        :initial="{ opacity: 0 }"
        :animate="{ opacity: 1 }"
        :exit="{ opacity: 0 }"
        :transition="FADE_FAST"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8"
      >
        <!-- 背景遮罩 + blur -->
        <motion.div
          :initial="{ backdropFilter: 'blur(0px)' }"
          :animate="{ backdropFilter: 'blur(12px)' }"
          :exit="{ backdropFilter: 'blur(0px)' }"
          :transition="FADE"
          class="absolute inset-0 bg-black/45"
          @click="emit('close')"
        />

        <!-- 主面板 (scale+y 渐入) -->
        <motion.div
          :initial="{ scale: 0.94, y: 16, opacity: 0 }"
          :animate="{ scale: 1, y: 0, opacity: 1 }"
          :exit="{ scale: 0.97, y: 8, opacity: 0 }"
          :transition="SPRING_SNUG"
          class="bg-card /60 relative w-full max-w-4xl overflow-hidden rounded-3xl border shadow-2xl"
        >
          <!-- 关闭按钮 -->
          <button
            type="button"
            class="bg-page/80 text-ink hover:bg-page /40 absolute top-4 right-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md transition-colors"
            aria-label="关闭"
            @click="emit('close')"
          >
            <X class="h-4 w-4" />
          </button>

          <div
            class="grid grid-cols-1 overflow-hidden md:grid-cols-[280px_1fr] md:items-stretch"
          >
            <!-- 封面 -->
            <div
              class="bg-surface relative aspect-[3/4] overflow-hidden md:aspect-auto md:h-full"
            >
              <img
                v-if="book.cover"
                :src="book.cover"
                :alt="book.title"
                class="h-full w-full object-cover"
              />
              <div
                v-else
                class="flex h-full w-full items-center justify-center"
                :style="{ background: coverGradient }"
              >
                <span
                  class="font-serif text-8xl font-bold text-white/85 drop-shadow-md"
                >
                  {{ book.title.slice(0, 1) }}
                </span>
              </div>

              <!-- 已读徽章 (覆盖在封面上) -->
              <span
                v-if="book.finishReading"
                class="bg-success/90 absolute top-3 right-3 rounded-full px-2.5 py-1 text-xs font-medium text-white shadow-sm"
              >
                ✓ 已读完
              </span>
            </div>

            <!-- 内容区 -->
            <div class="flex flex-col gap-6 p-6 md:p-8">
              <!-- 标题 + 作者 -->
              <div class="space-y-2 pr-10">
                <h2
                  class="text-ink font-serif text-2xl leading-tight font-semibold sm:text-3xl"
                >
                  {{ book.title }}
                </h2>
                <p class="text-muted text-base">
                  {{ book.author }}
                </p>
              </div>

              <!-- 进度区块 (错峰渐入) -->
              <motion.div
                :initial="{ opacity: 0, y: 10 }"
                :animate="{ opacity: 1, y: 0 }"
                :transition="{ delay: 0.18, duration: 0.3 }"
                class="space-y-3"
              >
                <div class="flex items-baseline justify-between">
                  <span class="text-ink text-3xl font-bold tabular-nums">
                    {{ formatProgressPercent(livePercent) }}
                  </span>
                  <button
                    type="button"
                    class="text-muted hover:text-ink flex items-center gap-1.5 text-xs transition-colors"
                    :disabled="progressLoading"
                    @click="handleRefresh"
                  >
                    <RefreshCw
                      :class="[
                        'h-3.5 w-3.5',
                        progressLoading ? 'animate-spin' : '',
                      ]"
                    />
                    {{ progressLoading ? '刷新中' : '刷新进度' }}
                  </button>
                </div>

                <!-- 进度条 -->
                <div
                  class="bg-surface relative h-1.5 overflow-hidden rounded-full"
                >
                  <motion.div
                    :initial="{ width: '0%' }"
                    :animate="{ width: `${livePercent}%` }"
                    :transition="{ ...EASE_SLOW, delay: 0.28, duration: 0.6 }"
                    class="bg-accent absolute inset-y-0 left-0 rounded-full"
                  />
                </div>

                <p v-if="progressError" class="text-destructive text-xs">
                  {{ progressError }}
                </p>
                <p
                  v-else-if="!hasProgress && !progressLoading"
                  class="text-muted text-xs"
                >
                  还没有阅读记录,打开微信读书开始第一页吧。
                </p>
              </motion.div>

              <!-- 统计 3 列 (错峰) -->
              <motion.div
                :initial="{ opacity: 0, y: 10 }"
                :animate="{ opacity: 1, y: 0 }"
                :transition="{ delay: 0.24, duration: 0.3 }"
                class="/40 grid grid-cols-3 gap-3 border-y py-4"
              >
                <div>
                  <p class="text-muted text-xs">累计阅读</p>
                  <p class="text-ink mt-1 text-lg font-semibold tabular-nums">
                    {{ formatDuration(liveProgress?.readingTime) }}
                  </p>
                </div>
                <div>
                  <p class="text-muted text-xs">最近阅读</p>
                  <p class="text-ink mt-1 text-lg font-semibold tabular-nums">
                    {{ formatRelative(liveProgress?.updateTime ?? null) }}
                  </p>
                </div>
                <div>
                  <p class="text-muted text-xs">状态</p>
                  <p class="text-ink mt-1 text-lg font-semibold tabular-nums">
                    {{
                      book.finishReading
                        ? '已读完'
                        : hasProgress
                          ? '在读'
                          : '待读'
                    }}
                  </p>
                </div>
              </motion.div>

              <!-- 操作 (错峰) -->
              <motion.div
                :initial="{ opacity: 0, y: 10 }"
                :animate="{ opacity: 1, y: 0 }"
                :transition="{ delay: 0.3, duration: 0.3 }"
                class="flex flex-wrap items-center gap-3"
              >
                <a
                  :href="`weread://reading?bId=${book.bookId}`"
                  class="bg-accent text-ink hover:bg-accent/90 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-colors"
                >
                  <BookOpen class="h-4 w-4" />
                  继续阅读
                </a>
                <button
                  type="button"
                  class="text-ink hover:bg-surface inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm transition-colors"
                >
                  <Eye class="h-4 w-4" />
                  标记读完
                </button>
                <button
                  type="button"
                  class="text-muted hover:text-ink inline-flex items-center gap-2 rounded-full px-3 py-2.5 text-sm transition-colors"
                  :title="book.secret ? '取消隐藏' : '隐藏'"
                >
                  <component :is="book.secret ? Eye : EyeOff" class="h-4 w-4" />
                </button>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>
