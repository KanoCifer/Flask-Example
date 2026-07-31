<template>
  <motion.div
    class="polaroid-card group relative block w-full cursor-pointer"
    :initial="{ opacity: 0, y: 24 }"
    :animate="{ opacity: 1, y: 0 }"
    :transition="{
      type: 'spring',
      stiffness: 220,
      damping: 24,
      duration: 0.5,
      delay: Math.min(index * 0.03, 0.4),
    }"
    :whileHover="{ y: -6, rotate: 0, transition: { duration: 0.2 } }"
    :style="{ rotate: `${rotation}deg` }"
    @click="onClick"
  >
    <!--
      PolaroidCard — 紧凑 grid 瀑布流版
      - 图片区由 aspect-ratio 自己撑开高度(后端 aspectRatio 已知 → 真实比例)
      - 卡片整体高度 = 图片 + 顶部白边 + 底部 52px 白边
      - 父级 grid-row span 用同样公式算,精确分配行数
      - 编辑模式:左上选中圈 + 右上删除按钮;非编辑模式:点击进详情
      - 状态:processing 柔光蒙层 + spinner; failed 已实现; ready/uploaded 正常
    -->
    <div class="polaroid group relative flex flex-col rounded-[2px]">
      <!-- 图片容器: aspect-ratio 驱动高度,object-cover 填满 -->
      <div
        class="polaroid-top relative mx-2 mt-3 overflow-hidden rounded-[1px] transition-all duration-300 group-hover:mx-0 group-hover:mt-0"
      >
        <div
          class="polaroid-photo relative w-full overflow-hidden"
          :style="{ aspectRatio: String(aspect) }"
        >
          <!-- 加载失败态 -->
          <template v-if="image.status === 'failed'">
            <div
              class="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-1 text-muted"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="h-6 w-6"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
              <span class="text-muted font-family-dongfang text-[10px] italic tracking-wide opacity-80">加载失败</span>
            </div>
          </template>

          <!-- 处理中态:柔色蒙层 + spinner -->
          <template v-else-if="image.status === 'processing'">
            <div
              class="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-1 text-muted"
            >
              <div
                class="border-accent/60 h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
                aria-hidden="true"
              ></div>
              <span class="text-muted font-family-dongfang text-[10px] italic tracking-wide opacity-80">处理中</span>
            </div>
          </template>

          <!-- 正常图片(优先缩略图,后端未回填时回退原图) -->
          <img
            v-else
            :src="photoSrc"
            :alt="image.description"
            class="pointer-events-none h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            loading="lazy"
            draggable="false"
          />

          <!-- Hover 胶片闪光点:克制的中央白点,不遮挡画面 -->
          <div
            v-if="showHoverOverlay"
            class="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            aria-hidden="true"
          >
            <div
              class="translate-y-2 rounded-full bg-white/70 p-2.5 opacity-0 backdrop-blur-[2px] transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 dark:bg-white/30"
            >
              <Maximize2 class="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>

      <!-- 底部宽白边:拍立得标志性"留白写字区" -->
      <div
        class="polaroid-bottom relative flex shrink-0 items-center justify-center"
        :style="{ height: '52px', paddingBottom: '10px' }"
      >
        <span class="polaroid-date font-family-averia select-none">
          {{ dateLabel }}
        </span>
      </div>

      <!-- 编辑模式:左上选中圈 -->
      <button
        v-if="isEditMode"
        type="button"
        class="absolute top-2 left-2 z-20 flex h-7 w-7 items-center justify-center rounded-full border-2 backdrop-blur-sm transition-all duration-200"
        :class="
          selected
            ? 'border-accent bg-accent text-ink shadow-sm'
            : 'border-white/80 bg-black/20 text-transparent hover:bg-black/40'
        "
        :aria-pressed="selected"
        aria-label="选中这张照片"
        @click.stop="emit('toggleSelect', image.id)"
      >
        <Check v-if="selected" class="h-4 w-4" />
      </button>

      <!-- 编辑模式:右上删除按钮 -->
      <button
        v-if="isEditMode"
        type="button"
        class="bg-destructive/90 hover:bg-destructive absolute top-2 right-2 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-white/60 text-white opacity-0 shadow-sm backdrop-blur-sm transition-all duration-200 group-hover:opacity-100"
        aria-label="删除这张照片"
        @click.stop="emit('delete', image.id)"
      >
        <Trash2 class="h-3.5 w-3.5" />
      </button>

      <!-- 选中态高亮描边 -->
      <div
        v-if="isEditMode && selected"
        class="ring-accent ring-offset-accent/20 pointer-events-none absolute inset-0 z-10 rounded-[2px] ring-2 ring-offset-2"
        aria-hidden="true"
      ></div>
    </div>
  </motion.div>
</template>

<script setup lang="ts">
import { Check, Maximize2, Trash2 } from '@lucide/vue';
import { motion } from 'motion-v';
import { computed, ref } from 'vue';
import type { GalleryImage } from '@readinglist/api';

const props = defineProps<{
  image: GalleryImage;
  index: number;
  aspect: number; // 后端真实 aspectRatio (w/h),驱动图片区高度
  rotation: number;
  isEditMode?: boolean;
  selected?: boolean;
}>();

const emit = defineEmits<{
  select: [image: GalleryImage, index: number];
  toggleSelect: [id: string];
  delete: [id: string];
}>();

// 拍立得底部日期:若图片有 uploadedAt / createdAt / date 字段则显示,否则留空槽
const dateLabel = computed(() => {
  const raw =
    (props.image as any).uploadedAt ??
    (props.image as any).createdAt ??
    (props.image as any).date ??
    null;
  if (!raw) return '— —';
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return '— —';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}.${m}`;
});

// 图片源:后端已回填 thumbnailUrl 时优先用,否则回退 url
const photoSrc = computed(
  () => props.image.thumbnailUrl ?? props.image.url,
);

// 处理中/失败态不显示 hover 放大镜
const showHoverOverlay = computed(
  () => !props.isEditMode && props.image.status !== 'processing' && props.image.status !== 'failed',
);

// 点击/选中区分:编辑模式下点击卡片切换选中,非编辑模式打开详情
const downPos = ref({ x: 0, y: 0 });
const onPointerDown = (e: PointerEvent) => {
  downPos.value = { x: e.clientX, y: e.clientY };
};
const onClick = (e: MouseEvent) => {
  // 复用 pointerdown 记录起点,避免误触
  void onPointerDown(e as unknown as PointerEvent);
  if (props.isEditMode) {
    emit('toggleSelect', props.image.id);
    return;
  }
  // 处理中/失败态不打开详情
  if (props.image.status === 'processing' || props.image.status === 'failed') return;
  emit('select', props.image, props.index);
};
</script>

<style scoped>
/* ============================================================
   Polaroid — 跟随主题 token(紧凑 grid 瀑布流版)
   白边 = var(--page)        阴影 = color-mix(--ink)
   ============================================================ */
.polaroid {
  background: var(--page);
  box-shadow:
    0 1px 1px color-mix(in oklch, var(--ink) 6%, transparent),
    0 6px 14px color-mix(in oklch, var(--ink) 10%, transparent),
    0 18px 32px color-mix(in oklch, var(--ink) 8%, transparent);
  transition:
    transform 0.25s ease,
    box-shadow 0.3s ease;
  will-change: transform, box-shadow;
}

.polaroid-card:hover .polaroid {
  box-shadow:
    0 2px 2px color-mix(in oklch, var(--ink) 8%, transparent),
    0 12px 24px color-mix(in oklch, var(--ink) 18%, transparent),
    0 28px 48px color-mix(in oklch, var(--ink) 14%, transparent);
}

.polaroid-top {
  background: var(--page);
}

.polaroid-photo {
  background: var(--secondary);
  /* 图片区上下加 1px 极细描边模拟胶片曝光边缘 */
  box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--ink) 8%, transparent);
}

.polaroid-bottom {
  background: var(--page);
}

.polaroid-date {
  font-size: 14px;
  letter-spacing: 0.04em;
  color: color-mix(in oklch, var(--ink) 55%, transparent);
}

/* 极轻的胶片颗粒感:白边微微泛黄/泛蓝,不影响图片本身 */
.polaroid::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background: color-mix(in oklch, var(--ink) 2%, transparent);
  mix-blend-mode: multiply;
  z-index: 1;
}
</style>
