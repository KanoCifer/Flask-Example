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
      PolaroidCard — 拍立得瀑布流版
      - 卡片宽度 = 列宽（100%），照片高度由 aspect-ratio 自适应
      - 保留 var(--page) 白边 + 日期 + 胶片质感
      - 编辑模式：左上选中圈 + 右上删除按钮；非编辑模式：点击进详情
    -->
    <div class="polaroid group relative flex flex-col rounded-[2px]">
      <!-- 顶部窄白边 + 图片容器 -->
      <div
        class="polaroid-top relative mx-2 mt-3 overflow-hidden rounded-[1px] transition-all duration-300 group-hover:mx-0 group-hover:mt-0"
      >
        <div
          class="polaroid-photo relative w-full overflow-hidden"
          :style="{ aspectRatio: String(1 / aspect) }"
        >
          <img
            :src="image.url"
            :alt="image.description"
            class="pointer-events-none h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
            loading="lazy"
            draggable="false"
          />

          <!-- Hover 胶片闪光点：克制的中央白点，不遮挡画面 -->
          <div
            v-if="!isEditMode"
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

      <!-- 底部宽白边：拍立得标志性"留白写字区" -->
      <div
        class="polaroid-bottom relative flex items-center justify-center"
        :style="{ height: '52px', paddingBottom: '10px' }"
      >
        <span class="polaroid-date font-family-averia select-none">
          {{ dateLabel }}
        </span>
      </div>

      <!-- 编辑模式：左上选中圈 -->
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

      <!-- 编辑模式：右上删除按钮 -->
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
import type { Picture } from '@/features/pic/composables';

const props = defineProps<{
  image: Picture;
  index: number;
  aspect: number;
  rotation: number;
  isEditMode?: boolean;
  selected?: boolean;
}>();

const emit = defineEmits<{
  select: [image: Picture, index: number];
  toggleSelect: [id: string];
  delete: [id: string];
}>();

// 拍立得底部日期：若图片有 uploadedAt / createdAt / date 字段则显示，否则留空槽
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

// 点击/选中区分：编辑模式下点击卡片切换选中，非编辑模式打开详情
const downPos = ref({ x: 0, y: 0 });
const onPointerDown = (e: PointerEvent) => {
  downPos.value = { x: e.clientX, y: e.clientY };
};
const onClick = (e: MouseEvent) => {
  // 复用 pointerdown 记录起点，避免误触
  void onPointerDown(e as unknown as PointerEvent);
  if (props.isEditMode) {
    emit('toggleSelect', props.image.id);
    return;
  }
  emit('select', props.image, props.index);
};
</script>

<style scoped>
/* ============================================================
   Polaroid — 跟随主题 token（拍立得瀑布流版）
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

/* 极轻的胶片颗粒感：白边微微泛黄/泛蓝，不影响图片本身 */
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
