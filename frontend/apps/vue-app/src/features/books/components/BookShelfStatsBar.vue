<template>
  <button
    v-if="weeklySnapshot"
    type="button"
    class="group block w-full border-t border-white/15 bg-black/30 px-4 py-2.5 text-left backdrop-blur-md transition-colors hover:bg-black/40 sm:px-6 md:px-10 md:py-3"
    @click="router.push('/bookshelf/stats')"
  >
    <div class="mx-auto flex max-w-6xl items-center gap-3 sm:gap-5">
      <!-- 本周阅读时长 -->
      <span class="inline-flex items-baseline gap-1.5 text-white">
        <span class="text-xs font-medium text-white/60">本周</span>
        <span class="font-serif text-sm font-bold tabular-nums sm:text-base">
          {{ formatDuration(weeklySnapshot.totalReadTime) }}
        </span>
      </span>

      <Dot />

      <!-- 阅读天数 -->
      <span class="inline-flex items-baseline gap-1.5 text-white">
        <span class="text-xs font-medium text-white/60">阅读</span>
        <span class="font-serif text-sm font-bold tabular-nums sm:text-base">
          {{ weeklySnapshot.readDays ?? 0 }}
        </span>
        <span class="text-xs text-white/60">天</span>
      </span>

      <!-- 最近在读(sm 以上才显示,移动端太挤) -->
      <template v-if="latestBook">
        <Dot class="hidden sm:inline-block" />
        <span
          class="hidden min-w-0 flex-1 items-baseline gap-1.5 text-white sm:inline-flex"
        >
          <span class="flex-shrink-0 text-xs font-medium text-white/60">
            最近
          </span>
          <span
            class="truncate text-sm font-medium"
            :title="latestBook.title ?? ''"
          >
            「{{ latestBook.title }}」
          </span>
          <span v-if="recencyLabel" class="flex-shrink-0 text-xs text-white/60">
            {{ recencyLabel }}
          </span>
        </span>
      </template>

      <!-- 占位让 CTA 靠右(没有 latestBook 时) -->
      <span v-else class="flex-1" />

      <!-- CTA -->
      <span
        class="inline-flex flex-shrink-0 items-center gap-1 text-xs font-medium text-white/70 transition-colors group-hover:text-white"
      >
        <span class="hidden sm:inline">看详情</span>
        <ChevronRight class="h-3.5 w-3.5" />
      </span>
    </div>
  </button>
</template>

<script setup lang="ts">
import { ChevronRight } from '@lucide/vue';
import dayjs from 'dayjs';
import { computed, h } from 'vue';
import { useRouter } from 'vue-router';
import type { ReadDetailSnapshot } from '@/features/books/api';
import { formatDuration } from '@/lib/dayjs';
import { formatRelative } from '@/lib/dayjs';

const props = defineProps<{
  weeklySnapshot: ReadDetailSnapshot | null;
}>();

const router = useRouter();

const latestBook = computed<{ title: string | null } | null>(() => {
  const s = props.weeklySnapshot;
  if (!s?.readLongest?.length) return null;
  const item = s.readLongest[0];
  const info = item.book ?? item.albumInfo ?? {};
  return {
    title: ((info as Record<string, unknown>)?.title as string | null) ?? null,
  };
});

/**
 * 统计快照的"最近"提示。
 * - < 7 天走 formatRelative(包含"刚刚 / X 小时前 / 昨天 / X 天前")
 * - ≥ 7 天视为历史快照,显示绝对日期更明确
 *
 * 读 longest 列表本身没带 readUpdateTime 字段,暂以 weeklySnapshot.fetched_at
 * 作 proxy;后续接入更精确字段时直接换入参即可。
 */
const recencyLabel = computed(() => {
  const ts = props.weeklySnapshot?.fetched_at;
  if (!ts) return '';
  const d = dayjs(ts);
  if (!d.isValid()) return '';
  if (dayjs().diff(d, 'day') >= 7) return d.format('M/D');
  return formatRelative(ts);
});

// 内联小点分隔符
const Dot = () =>
  h('span', {
    'aria-hidden': 'true',
    class: 'h-1 w-1 flex-shrink-0 rounded-full bg-white/30',
  });
</script>
