<script setup lang="ts">
import { useGreeting } from '@/features/entry/composables';
import { useStorage } from '@vueuse/core';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const showToast = ref(false);
const hasClosed = useStorage<boolean>(
  'greeting_toast_closed',
  false,
  sessionStorage,
);

const { isDay, greeting, changelogHint } = useGreeting();

onMounted(() => {
  if (hasClosed.value) return;
  setTimeout(() => {
    showToast.value = true;
  }, 5000);
});

const closeToast = () => {
  showToast.value = false;
  hasClosed.value = true;
};

const goToChangelog = () => {
  router.push('/version-log');
  closeToast();
};
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="animate-message-pop"
      leave-active-class="animate-toast-out"
    >
      <div
        v-if="showToast"
        class="group bg-page/95 fixed bottom-6 left-4 z-50 w-[300px] overflow-hidden rounded-2xl border shadow-lg backdrop-blur-sm transition-all duration-500 ease-out hover:-translate-y-1 hover:shadow-xl sm:bottom-8 sm:left-8"
      >
        <div class="relative px-4 py-4">
          <!-- 关闭按钮 -->
          <button
            @click="closeToast"
            class="text-muted/60 hover:bg-surface hover:text-ink absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full transition-all duration-200 hover:scale-110"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>

          <!-- 内容 -->
          <div class="flex items-center gap-3">
            <div
              class="bg-warning/15 ring-warning/20 relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1"
              style="
                box-shadow: 0 0 12px
                  color-mix(in srgb, var(--color-warning) 25%, transparent);
              "
            >
              <svg
                v-if="isDay"
                class="text-warning size-5"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <circle cx="12" cy="12" r="5" />
                <g
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                >
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </g>
              </svg>
              <svg
                v-else
                class="text-warning/70 size-5"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </div>

            <!-- 文字 -->
            <div class="min-w-0 flex-1">
              <h3
                class="text-ink font-serif text-sm font-semibold tracking-wide"
              >
                {{ greeting }}
              </h3>
              <p class="text-muted mt-0.5 truncate text-xs">
                {{ changelogHint }}
              </p>
            </div>
          </div>

          <!-- CTA 按钮：hover 流光 -->
          <button
            @click="goToChangelog"
            class="group/btn bg-accent text-contrast hover:bg-accent/90 relative mt-3 flex w-full items-center justify-center gap-1.5 overflow-hidden rounded-xl py-2 text-xs font-medium shadow-sm transition-all duration-300 hover:shadow-md active:scale-[0.97]"
          >
            <span class="relative z-10">查看更新日志</span>
            <svg
              class="relative z-10 transition-transform duration-300 group-hover/btn:translate-x-0.5"
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
            <!-- 流光条纹 -->
            <div
              class="via-accent/25 absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent to-transparent transition-transform duration-500 group-hover/btn:translate-x-full"
            />
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
@keyframes toast-in {
  0% {
    opacity: 0;
    transform: translateY(24px) scale(0.92);
  }
  60% {
    opacity: 1;
    transform: translateY(-6px) scale(1.02);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes toast-out {
  0% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(12px) scale(0.94);
  }
}

@keyframes icon-glow {
  0%,
  100% {
    opacity: 0.85;
  }
  50% {
    opacity: 1;
  }
}

.animate-toast-in {
  animation: toast-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.animate-toast-out {
  animation: toast-out 0.2s ease-out forwards;
}

.animate-icon-glow {
  animation: icon-glow 3s ease-in-out infinite;
}
</style>
