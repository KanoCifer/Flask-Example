<script setup lang="ts">
import { onBeforeUnmount, ref, useTemplateRef } from 'vue';
import { useEventListener } from '@vueuse/core';
import StatusMini from '@/features/status/components/StatusMini.vue';
import { useVisitorCountStore } from '@/stores';

const visitorCount = useVisitorCountStore();

const open = ref(false);
const triggerRef = useTemplateRef<HTMLElement>('triggerRef');
const popoverRef = useTemplateRef<HTMLElement>('popoverRef');

const popoverStyle = ref<Record<string, string>>({});

function updatePosition() {
  const t = triggerRef.value;
  const tRect = t?.getBoundingClientRect();
  if (!tRect) return;

  const left = tRect.right - 420;
  popoverStyle.value = {
    position: 'fixed',
    top: `${tRect.top - 18 * tRect.height}px`,
    left: `${left}px`,
    width: '420px',
    zIndex: '100',
  };
}

let openTimer: ReturnType<typeof setTimeout> | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;

function clearTimers() {
  if (openTimer) {
    clearTimeout(openTimer);
    openTimer = null;
  }
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
}

function scheduleOpen() {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  if (open.value) return;
  openTimer = setTimeout(() => {
    open.value = true;
    requestAnimationFrame(updatePosition);
  }, 400);
}

function scheduleClose() {
  if (openTimer) {
    clearTimeout(openTimer);
    openTimer = null;
  }
  closeTimer = setTimeout(() => {
    open.value = false;
  }, 150);
}

useEventListener(window, 'scroll', () => open.value && updatePosition(), {
  passive: true,
});
useEventListener(window, 'resize', () => open.value && updatePosition());

onBeforeUnmount(() => clearTimers());
</script>

<template>
  <span
    ref="triggerRef"
    class="inline-flex"
    @mouseenter="scheduleOpen"
    @mouseleave="scheduleClose"
    @focusin="scheduleOpen"
    @focusout="scheduleClose"
  >
    <slot name="trigger" />
  </span>

  <Teleport to="body">
    <div
      v-if="open"
      ref="popoverRef"
      role="dialog"
      aria-label="Service Status"
      data-state="open"
      :style="popoverStyle"
      class="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 rounded-lg outline-none"
      @mouseenter="scheduleOpen"
      @mouseleave="scheduleClose"
    >
      <div
        class="bg-page/95 supports-[backdrop-filter]:bg-page/80 /60 overflow-hidden rounded-lg border shadow-xl backdrop-blur-md"
      >
        <header
          class="/40 bg-surface/30 flex items-center gap-2.5 border-b px-3 py-2"
        >
          <div class="flex items-center gap-1">
            <span class="h-2 w-2 rounded-full bg-red-400/70" />
            <span class="h-2 w-2 rounded-full bg-yellow-400/70" />
            <span class="h-2 w-2 rounded-full bg-emerald-400/70" />
          </div>
          <span class="text-ink/80 font-serif text-[12px] tracking-wide italic"
            >Service Status</span
          >
          <span
            class="text-muted/60 ml-auto font-mono text-[10px] tracking-[0.1em] lowercase"
            >/status</span
          >
        </header>

        <StatusMini />

        <footer
          class="/40 text-muted/70 flex items-center justify-between border-t px-3 py-1.5 font-mono text-[10px] tracking-[0.15em] uppercase"
        >
          <span>live preview</span>
          <span class="inline-flex items-center gap-1.5">
            <span class="bg-success h-1 w-1 rounded-full" />
            <span>{{ visitorCount.count }} online</span>
          </span>
        </footer>
      </div>
    </div>
  </Teleport>
</template>
