<template>
  <div
    v-bind="$attrs"
    class="relative"
    @mouseenter="open"
    @mouseleave="scheduleClose"
  >
    <slot name="trigger" :is-open="isOpen" :close="close" />
    <DropdownTransition>
      <div v-if="isOpen" :class="panelClass">
        <slot :is-open="isOpen" :close="close" />
      </div>
    </DropdownTransition>
  </div>
</template>

<script setup lang="ts">
import { DropdownTransition } from '@/components';
import { onUnmounted, ref } from 'vue';

defineOptions({ name: 'HoverDropdown' });

const {
  closeDelay = 150,
  /** panel 定位/尺寸 class — 通常包含 absolute + top/right/bottom/left + w-* + p-* */
  panelClass = '',
} = defineProps<{
  closeDelay?: number;
  panelClass?: string;
}>();

const isOpen = ref(false);
let closeTimeout: ReturnType<typeof setTimeout> | null = null;

const open = () => {
  if (closeTimeout) {
    clearTimeout(closeTimeout);
    closeTimeout = null;
  }
  isOpen.value = true;
};

const scheduleClose = () => {
  closeTimeout = setTimeout(() => {
    isOpen.value = false;
  }, closeDelay);
};

const close = () => {
  if (closeTimeout) {
    clearTimeout(closeTimeout);
    closeTimeout = null;
  }
  isOpen.value = false;
};

onUnmounted(() => {
  if (closeTimeout) clearTimeout(closeTimeout);
});
</script>
