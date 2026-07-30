<template>
  <!--
    包裹 slot,事件委托捕获 slot 内任意 <img> 的点击 → 打开全屏 lightbox。
    多个 img 时支持 ←/→ 切换;ESC / 遮罩 / 关闭按钮关闭。
  -->
  <div ref="rootRef" :class="rootClass" @click="handleClick">
    <slot />
  </div>

  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="lightboxIndex !== null"
        :key="'image-viewer-lightbox'"
        :initial="{ opacity: 0 }"
        :animate="{ opacity: 1 }"
        :exit="{ opacity: 0 }"
        :transition="FADE_FAST"
        class="fixed inset-0 z-[60] flex items-center justify-center"
        role="dialog"
        aria-modal="true"
        @keydown="onKeydown"
      >
        <!-- 遮罩 -->
        <div
          class="bg-ink/80 absolute inset-0 backdrop-blur-sm"
          @click="onMaskClick"
        />

        <!-- 顶部工具条 -->
        <div
          class="text-page absolute top-0 right-0 left-0 z-10 flex items-center justify-between px-5 py-4"
        >
          <span class="font-mono text-sm tabular-nums">
            {{ lightboxIndex + 1 }} / {{ imageList.length }}
          </span>
          <Button
            variant="ghost"
            size="icon"
            class="!text-page hover:!bg-page/20 !h-9 !w-9 !rounded-full"
            aria-label="关闭"
            @click="close"
          >
            <X class="h-5 w-5" />
          </Button>
        </div>

        <!-- 左切换 -->
        <Button
          v-if="imageList.length > 1"
          variant="ghost"
          size="icon"
          class="!text-page hover:!bg-page/20 absolute left-4 z-10 !h-11 !w-11 !rounded-full"
          aria-label="上一张"
          @click="prev"
        >
          <ChevronLeft class="h-6 w-6" />
        </Button>

        <!-- 主图 -->
        <motion.img
          :key="currentSrc"
          :src="currentSrc"
          :alt="currentAlt"
          :initial="{ opacity: 0, scale: 0.98 }"
          :animate="{ opacity: 1, scale: 1 }"
          :exit="{ opacity: 0, scale: 0.98 }"
          :transition="SPRING_SNUG"
          class="relative z-[1] max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
        />

        <!-- 右切换 -->
        <Button
          v-if="imageList.length > 1"
          variant="ghost"
          size="icon"
          class="!text-page hover:!bg-page/20 absolute right-4 z-10 !h-11 !w-11 !rounded-full"
          aria-label="下一张"
          @click="next"
        >
          <ChevronRight class="h-6 w-6" />
        </Button>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * ImageViewer —— 通用图片放大查看容器。
 *
 * 用法:
 *   <ImageViewer>
 *     <img src="a.jpg" alt="A" />
 *     <img src="b.jpg" alt="B" />
 *   </ImageViewer>
 *
 * 点击 slot 内任意 `<img>` 打开全屏 lightbox;多个图片时支持 ←/→ 切换。
 * 事件委托在容器根 `<div>` 上,无需给每张图手写 click。
 * 通过 MutationObserver 监听 slot 内 img 的增减,保证 prev/next 与实际 DOM 同步。
 *
 * 跳过规则:
 * - 标记 `data-no-zoom` 的 img 不会被放大(子组件可逃生)
 * - `disabled` prop 可整体关闭放大行为
 */
import { Button } from '@/components';
import { ChevronLeft, ChevronRight, X } from '@lucide/vue';
import { AnimatePresence, motion } from 'motion-v';
import { FADE_FAST, SPRING_SNUG } from '@/constants';
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useTemplateRef,
  watch,
} from 'vue';

defineOptions({ name: 'ImageViewer' });

const props = withDefaults(
  defineProps<{
    /** 是否启用点击放大,默认 true */
    enabled?: boolean;
    /** 点击遮罩是否关闭,默认 true */
    closeOnMaskClick?: boolean;
    /** Esc 是否关闭,默认 true */
    closeOnEsc?: boolean;
    /** 是否在 lightbox 打开时锁定 body 滚动,默认 true */
    lockScroll?: boolean;
  }>(),
  {
    enabled: true,
    closeOnMaskClick: true,
    closeOnEsc: true,
    lockScroll: true,
  },
);

const rootRef = useTemplateRef<HTMLElement>('rootRef');
const imageList = ref<string[]>([]);
const imageAlts = ref<string[]>([]);
const lightboxIndex = ref<number | null>(null);

const rootClass = computed(() => (props.enabled ? 'contents' : ''));

const currentSrc = computed(() =>
  lightboxIndex.value !== null
    ? (imageList.value[lightboxIndex.value] ?? '')
    : '',
);
const currentAlt = computed(() =>
  lightboxIndex.value !== null
    ? (imageAlts.value[lightboxIndex.value] ?? '')
    : '',
);

// —— DOM 扫描 + MutationObserver ———————————————————————

function scanImages(): void {
  if (!rootRef.value) {
    imageList.value = [];
    imageAlts.value = [];
    return;
  }
  const imgs = Array.from(rootRef.value.querySelectorAll('img'));
  const srcs: string[] = [];
  const alts: string[] = [];
  for (const img of imgs) {
    if (img.hasAttribute('data-no-zoom')) continue;
    const src = img.currentSrc || img.src;
    if (!src) continue;
    srcs.push(src);
    alts.push(img.getAttribute('alt') ?? '');
  }
  imageList.value = srcs;
  imageAlts.value = alts;
}

let observer: MutationObserver | null = null;

function setupObserver(): void {
  if (!rootRef.value) return;
  observer = new MutationObserver(() => scanImages());
  observer.observe(rootRef.value, { childList: true, subtree: true });
}

function teardownObserver(): void {
  observer?.disconnect();
  observer = null;
}

// 在 lightbox 打开前确保 imageList 与 DOM 一致
watch(
  () => lightboxIndex.value,
  async (idx) => {
    if (idx !== null) {
      await nextTick();
      scanImages();
    }
  },
);

onBeforeUnmount(() => {
  teardownObserver();
  if (scrollLockCount > 0) {
    scrollLockCount = 0;
    document.body.style.overflow = prevOverflow;
    document.body.style.paddingRight = prevPaddingRight;
  }
  document.removeEventListener('keydown', onKeydown);
});

// —— 事件委托 ————————————————————————

function handleClick(e: MouseEvent): void {
  if (!props.enabled) return;
  const target = e.target as HTMLElement | null;
  if (!target) return;
  // closest('img') 兼容 <picture>、<figure><img></figure>、<a><img></a> 等包裹结构
  const img = target.closest('img') as HTMLImageElement | null;
  if (!img || img.hasAttribute('data-no-zoom')) return;
  if (!rootRef.value || !rootRef.value.contains(img)) return;

  scanImages();
  const src = img.currentSrc || img.src;
  const idx = imageList.value.indexOf(src);
  if (idx < 0) return;

  e.preventDefault();
  open(idx);
}

// —— Lightbox 行为 ————————————————————————

function open(idx: number): void {
  lightboxIndex.value = idx;
  if (props.lockScroll) lockScroll();
  document.addEventListener('keydown', onKeydown);
}

function close(): void {
  lightboxIndex.value = null;
  if (props.lockScroll) unlockScroll();
  document.removeEventListener('keydown', onKeydown);
}

function prev(): void {
  if (lightboxIndex.value === null || imageList.value.length === 0) return;
  lightboxIndex.value =
    lightboxIndex.value <= 0
      ? imageList.value.length - 1
      : lightboxIndex.value - 1;
}

function next(): void {
  if (lightboxIndex.value === null || imageList.value.length === 0) return;
  lightboxIndex.value =
    lightboxIndex.value >= imageList.value.length - 1
      ? 0
      : lightboxIndex.value + 1;
}

function onMaskClick(): void {
  if (props.closeOnMaskClick) close();
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && props.closeOnEsc) {
    e.preventDefault();
    close();
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    prev();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    next();
  }
}

// —— 滚动锁定(参考 Modal.vue) ——————————————————

let prevOverflow = '';
let prevPaddingRight = '';
let scrollLockCount = 0;

function lockScroll(): void {
  if (typeof document === 'undefined') return;
  if (scrollLockCount === 0) {
    const sbWidth = window.innerWidth - document.documentElement.clientWidth;
    prevOverflow = document.body.style.overflow;
    prevPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = 'hidden';
    if (sbWidth > 0) {
      document.body.style.paddingRight = `${sbWidth}px`;
    }
  }
  scrollLockCount++;
}

function unlockScroll(): void {
  if (typeof document === 'undefined') return;
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = prevOverflow;
    document.body.style.paddingRight = prevPaddingRight;
  }
}

// 初始化观察者(挂载后)
// 必须在 onMounted 里挂 observer:queueMicrotask 会先于 Vue 的首次渲染触发,
// 此时 rootRef 仍是 null,observer 永远装不上,后续 slot 内容也无法被发现。
onMounted(() => {
  scanImages();
  setupObserver();
});
</script>
