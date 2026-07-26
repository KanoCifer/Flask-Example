<template>
  <!-- 一行元数据：卷序 + 心情 + 时间 -->
  <div
    class="text-muted flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] tracking-wide"
  >
    <!-- 卷序：基于 published_at 在同年内累计 -->
    <span v-if="volumeLabel" class="text-ink/60 font-serif">
      {{ volumeLabel }}
    </span>

    <!-- 心情：emoji 或自定义文本 -->
    <span v-if="moment.mood" class="inline-flex items-center gap-1">
      <span aria-hidden="true">{{ moodEmoji }}</span>
      <span class="text-ink/70 italic">{{ moodText }}</span>
    </span>

    <!-- 标签在前置位 -->
    <span v-if="moment.tags.length" class="text-border" aria-hidden="true"
      >·</span
    >

    <!-- 时间戳 -->
    <time class="tabular-nums" :datetime="moment.published_at ?? ''">
      {{ formatDate(moment.published_at ?? '') }}
    </time>

    <!-- 置顶标 -->
    <span
      v-if="moment.is_pinned"
      class="text-warning inline-flex items-center gap-1 font-semibold tracking-[0.18em] uppercase"
    >
      <span aria-hidden="true">·</span>
      <Star class="h-3 w-3" />
      <span>置顶</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import type { Moment } from '@/features/moments/types';
import { formatDate } from '@/lib';
import { Star } from '@lucide/vue';
import { computed } from 'vue';

const props = defineProps<{
  moment: Moment;
  /** 卷序号文本，例如 "卷十二"；不传则不展示 */
  volumeLabel?: string;
}>();

// mood 字段允许直接写 emoji，也允许写"开心"等中文词——这里不做翻译，
// 仅在用户写纯文本时套上一对括号以提示这是 mood。
const isPureEmoji = (s: string) => /\p{Extended_Pictographic}/u.test(s);
const moodEmoji = computed(() => {
  const m = props.moment.mood ?? '';
  return isPureEmoji(m) ? m : '·';
});
const moodText = computed(() => {
  const m = props.moment.mood ?? '';
  return isPureEmoji(m) ? '' : m;
});
</script>
