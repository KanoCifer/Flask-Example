<script setup lang="ts">
import { IconClose } from '@/components';
import { IconInfo } from '@/components';
import { IconWarning } from '@/components';
import { useNotificationStore } from '@/stores';
import { AnimatePresence, motion } from 'motion-v';
import { computed, defineAsyncComponent, onUnmounted, ref } from 'vue';

import errorAnimationData from '@/assets/error.json';
import successAnimationData from '@/assets/success.json';

const Vue3Lottie = defineAsyncComponent(() =>
  import('vue3-lottie').then((m) => m.Vue3Lottie),
);
const lottieContainer = ref<typeof Vue3Lottie | null>(null);
const store = useNotificationStore();
const toasts = computed(() => store.toasts);

function getIconForType(type: string) {
  switch (type) {
    case 'success':
      return 'success-lottie';
    case 'error':
      return 'error-lottie';
    case 'warning':
      return IconWarning;
    default:
      return IconInfo;
  }
}

// function classForType(type: string) {
//   switch (type) {
//     case "success":
//       return "border-l-4 border-success";
//     case "error":
//       return "border-l-4 border-destructive";
//     case "warning":
//       return "border-l-4 border-warning";
//     default:
//       return "border-l-4 border-accent";
//   }
// }

function iconColorForType(type: string) {
  switch (type) {
    case 'success':
      return 'text-success';
    case 'error':
      return 'text-destructive';
    case 'warning':
      return 'text-warning';
    default:
      return 'text-ink';
  }
}

onUnmounted(() => {
  lottieContainer.value?.destroy();
});
</script>

<template>
  <div class="fixed top-4 left-1/2 z-9999 w-full -translate-x-1/2 sm:w-96">
    <AnimatePresence mode="popLayout">
      <motion.div
        v-for="(t, i) in toasts"
        :key="t.id"
        :initial="{ opacity: 0, y: -40, scale: 0.9 }"
        :animate="{
          opacity:
            toasts.length - 1 - i >= 3 ? 0 : 1 - (toasts.length - 1 - i) * 0.15,
          y: (toasts.length - 1 - i) * 16,
          scale: 1 - (toasts.length - 1 - i) * 0.05,
          zIndex: i,
          pointerEvents: toasts.length - 1 - i >= 3 ? 'none' : 'auto',
        }"
        :exit="{ opacity: 0, y: -40, scale: 0.9 }"
        :transition="{ type: 'spring', damping: 30, stiffness: 500 }"
        class="card"
        :class="[
          'squircle bg-page/80 text-ink dark:bg-page/80 dark:text-ink absolute top-0 left-0 flex h-20 w-full items-center justify-between gap-3 backdrop-blur-sm transition-colors duration-300',
        ]"
      >
        <component
          v-if="
            getIconForType(t.type) !== 'success-lottie' &&
            getIconForType(t.type) !== 'error-lottie'
          "
          :is="getIconForType(t.type)"
          :class="['shrink-0', iconColorForType(t.type)]"
        />
        <Vue3Lottie
          v-else-if="
            getIconForType(t.type) === 'success-lottie' && successAnimationData
          "
          :animationData="successAnimationData"
          :height="96"
          :width="96"
          :loop="true"
          :autoPlay="true"
          renderer="svg"
          :noMargin="true"
          class="z-10 shrink-0"
          ref="lottieContainer"
        />
        <Vue3Lottie
          v-else-if="
            getIconForType(t.type) === 'error-lottie' && errorAnimationData
          "
          :animationData="errorAnimationData"
          :loop="false"
          :autoPlay="true"
          renderer="svg"
          :height="96"
          :width="96"
          :noMargin="true"
          class="z-10 shrink-0"
          ref="lottieContainer"
        />

        <div
          class="text-muted dark:text-ink flex-1 text-sm leading-snug font-semibold"
        >
          {{ t.message }}
        </div>
        <button
          class="bg-secondary/60 text-ink/80 hover:bg-secondary mr-2 ml-auto shrink-0 cursor-pointer rounded-full p-2 transition-colors"
          @click="() => store.dismiss(t.id)"
          aria-label="dismiss"
        >
          <IconClose />
        </button>
      </motion.div>
    </AnimatePresence>
  </div>
</template>

<style scoped>
.card {
  border: 1px solid rgb(255 255 255 / 0.6);
  box-shadow:
    inset 0 1px 1px rgb(255 255 255 / 0.7),
    inset 0 -1px 2px rgb(0 0 0 / 0.03),
    0 3px 8px rgb(0 0 0 / 0.06),
    0 1px 3px rgb(0 0 0 / 0.04);
}

.dark .card {
  border-color: rgb(255 255 255 / 0.12);
  box-shadow:
    inset 0 1px 1px rgb(255 255 255 / 0.12),
    inset 0 -1px 2px rgb(0 0 0 / 0.1),
    0 3px 8px rgb(0 0 0 / 0.2),
    0 1px 3px rgb(0 0 0 / 0.15);
}
</style>
