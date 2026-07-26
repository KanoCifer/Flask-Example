<template>
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="open"
        :key="'overlay'"
        :initial="{ opacity: 0 }"
        :animate="{ opacity: 1 }"
        :exit="{ opacity: 0 }"
        :transition="FADE_FAST"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8"
        @click.self="onMaskClick"
      >
        <!-- 背景遮罩 + blur -->
        <div
          class="absolute inset-0 bg-black/45 backdrop-blur-[10px]"
          @click="emit('close')"
        />

        <!-- 主面板 -->
        <motion.div
          :initial="{ scale: 0.95, y: 12, opacity: 0 }"
          :animate="{ scale: 1, y: 0, opacity: 1 }"
          :exit="{ scale: 0.97, y: 6, opacity: 0 }"
          :transition="SPRING_SNUG"
          :class="[
            'bg-card /60 relative w-full overflow-hidden rounded-2xl border shadow-2xl',
            sizeClass,
          ]"
          role="dialog"
          aria-modal="true"
        >
          <slot />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v';
import { FADE_FAST, SPRING_SNUG } from '@/constants';
import { computed, onBeforeUnmount, watch } from 'vue';

defineOptions({ name: 'UiModal' });

const props = withDefaults(
  defineProps<{
    open: boolean;
    /** sm: 420px, md: 560px (default), lg: 720px, xl: 880px */
    size?: 'sm' | 'md' | 'lg' | 'xl';
    /** 点遮罩是否关闭,默认 true */
    maskClosable?: boolean;
    /** Esc 是否关闭,默认 true */
    escClosable?: boolean;
  }>(),
  {
    size: 'md',
    maskClosable: true,
    escClosable: true,
  },
);

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const sizeClass = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'sm:max-w-[420px]';
    case 'lg':
      return 'sm:max-w-[720px]';
    case 'xl':
      return 'sm:max-w-[880px]';
    case 'md':
    default:
      return 'sm:max-w-[560px]';
  }
});

function onMaskClick() {
  if (props.maskClosable) emit('close');
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.escClosable) {
    emit('close');
  }
}

// 打开时:锁滚动 + 注册 Esc
let prevOverflow = '';
let prevPaddingRight = '';
let scrollLockCount = 0;

function lockScroll() {
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

function unlockScroll() {
  if (typeof document === 'undefined') return;
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = prevOverflow;
    document.body.style.paddingRight = prevPaddingRight;
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      lockScroll();
      document.addEventListener('keydown', onKeydown);
    } else {
      unlockScroll();
      document.removeEventListener('keydown', onKeydown);
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  if (scrollLockCount > 0) {
    scrollLockCount = 0;
    document.body.style.overflow = prevOverflow;
    document.body.style.paddingRight = prevPaddingRight;
  }
});
</script>
