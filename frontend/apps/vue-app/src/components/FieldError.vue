<script setup lang="ts">
import { AlertCircle } from '@lucide/vue';
import { useMediaQuery } from '@vueuse/core';
import { motion } from 'motion-v';
import { ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    message?: string | null;
    /** 当 message 为空且 hint 非空时显示提示文案（如 ImportBook 的 api-key 字段） */
    hint?: string;
    /** 'sm' 默认（mt-1.5 text-sm），'xs' 用于更紧凑的字段（mt-1 text-xs） */
    size?: 'sm' | 'xs';
    /** 隐藏默认的 AlertCircle 图标 */
    hideIcon?: boolean;
    /** 基础 id。错误时输出 `${id}-error`，提示时输出 `${id}-hint`，便于 aria-describedby 转发 */
    id?: string;
  }>(),
  { size: 'sm', hideIcon: false },
);

// 抖动触发：错误"出现"（从空 → 有文案）触发一次
const appearanceId = ref(0);
watch(
  () => props.message,
  (next, prev) => {
    if (!prev && next) {
      appearanceId.value++;
    }
  },
);

// 守卫 prefers-reduced-motion：开启时不抖
const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');

const SHAKE = { x: [0, -8, 8, -6, 6, -4, 4, -2, 2, 0] };
const SHAKE_TRANSITION = { duration: 0.45, ease: 'easeInOut' };
</script>

<template>
  <motion.span
    v-if="message"
    :id="id ? `${id}-error` : undefined"
    :key="appearanceId"
    :animate="reduced ? undefined : SHAKE"
    :transition="SHAKE_TRANSITION"
    :class="[
      'text-destructive bg-destructive/10 flex items-center gap-1.5 rounded-xl px-2 py-1',
      size === 'xs' ? 'mt-1 text-xs' : 'mt-1.5 text-sm',
    ]"
    aria-live="assertive"
  >
    <AlertCircle v-if="!hideIcon" class="size-4 shrink-0" />
    {{ message }}
  </motion.span>
  <p
    v-else-if="hint"
    :id="id ? `${id}-hint` : undefined"
    :class="['text-muted', size === 'xs' ? 'mt-1 text-xs' : 'mt-1.5 text-sm']"
  >
    {{ hint }}
  </p>
</template>
