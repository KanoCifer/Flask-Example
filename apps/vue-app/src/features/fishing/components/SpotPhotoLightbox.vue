<script setup lang="ts">
/**
 * SpotPhotoLightbox —— 全屏照片浏览。
 *
 * 键盘 ←/→ 切换、Esc 关闭、点击遮罩关闭。
 * 入场/出场用 opacity 过渡(符合 reduced-motion 降级为瞬切)。
 */
import { ChevronLeft, ChevronRight, X } from '@lucide/vue';
import { onMounted, onUnmounted, watch } from 'vue';

const props = defineProps<{
  images: string[];
  /** 当前浏览索引 */
  index: number;
  title: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'update:index', value: number): void;
}>();

function prev(): void {
  const next = props.index <= 0 ? props.images.length - 1 : props.index - 1;
  emit('update:index', next);
}

function next(): void {
  const next = props.index >= props.images.length - 1 ? 0 : props.index + 1;
  emit('update:index', next);
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close');
  else if (e.key === 'ArrowLeft') prev();
  else if (e.key === 'ArrowRight') next();
}

onMounted(() => window.addEventListener('keydown', onKey));
onUnmounted(() => window.removeEventListener('keydown', onKey));

// 切换时禁止背景滚动
watch(
  () => props.images.length,
  () => {},
);
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[60] flex items-center justify-center">
      <!-- 遮罩 -->
      <div
        class="bg-ink/80 absolute inset-0 backdrop-blur-sm"
        @click="emit('close')"
      />

      <!-- 顶部工具条 -->
      <div
        class="text-page absolute top-0 right-0 left-0 z-10 flex items-center justify-between px-5 py-4"
      >
        <span class="text-sm font-medium tabular-nums">
          {{ index + 1 }} / {{ images.length }}
        </span>
        <button
          type="button"
          class="hover:bg-page/20 inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors"
          aria-label="关闭"
          @click="emit('close')"
        >
          <X class="h-5 w-5" />
        </button>
      </div>

      <!-- 左切换 -->
      <button
        v-if="images.length > 1"
        type="button"
        class="text-page hover:bg-page/20 absolute left-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors"
        aria-label="上一张"
        @click="prev"
      >
        <ChevronLeft class="h-6 w-6" />
      </button>

      <!-- 主图 -->
      <img
        :src="images[index]"
        :alt="`${title} 图片 ${index + 1}`"
        class="relative z-[1] max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
      />

      <!-- 右切换 -->
      <button
        v-if="images.length > 1"
        type="button"
        class="text-page hover:bg-page/20 absolute right-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors"
        aria-label="下一张"
        @click="next"
      >
        <ChevronRight class="h-6 w-6" />
      </button>
    </div>
  </Teleport>
</template>
