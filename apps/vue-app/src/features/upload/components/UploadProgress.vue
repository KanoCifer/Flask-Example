<script setup lang="ts">
/**
 * UploadProgress —— 0-100 进度条。
 *
 * - 自动 clamp 到 [0, 100]，传入越界值不会破坏布局。
 * - 100 时进度条转 success 配色。
 * - 通过 slot 提供额外文本（如 "上传中 65%" / "已完成"）。
 */
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    /** 进度百分比 0-100，超界会自动 clamp。 */
    progress: number;
    /** 是否显示百分比文字（默认 false，由调用方通过 slot 控制）。 */
    showLabel?: boolean;
    /** 自定义高度（如 'h-1' / 'h-2'）。 */
    height?: string;
  }>(),
  {
    showLabel: false,
    height: 'h-2',
  },
);

// clamp 到 [0, 100]，避免传入越界值时进度条溢出
const clamped = computed(() => Math.max(0, Math.min(100, props.progress)));
const isDone = computed(() => clamped.value >= 100);
</script>

<template>
  <div class="flex w-full flex-col gap-2">
    <!-- 头部：左侧标题，右侧百分比 -->
    <div
      v-if="showLabel || $slots.label"
      class="flex items-center justify-between text-xs"
    >
      <span class="text-muted font-medium">
        <slot name="label">上传进度</slot>
      </span>
      <span class="text-ink tabular-nums">{{ clamped }}%</span>
    </div>

    <!-- 进度条轨道 -->
    <div
      :class="[
        'bg-surface relative w-full overflow-hidden rounded-full',
        height,
      ]"
      role="progressbar"
      :aria-valuenow="clamped"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <!-- 进度条填充 -->
      <div
        :class="[
          'h-full rounded-full transition-all duration-300 ease-out',
          isDone ? 'bg-success' : 'bg-accent',
        ]"
        :style="{ width: `${clamped}%` }"
      />
    </div>
  </div>
</template>
