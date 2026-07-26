<script setup lang="ts">
/**
 * 确认按钮。点击时先 emit，让父级决定行为；emit 之后自动关闭弹窗。
 */
import type { HTMLAttributes } from 'vue';
import { inject } from 'vue';

const setOpen = inject<(v: boolean) => void>('alertDialog.setOpen', () => {});

const props = defineProps<{
  class?: HTMLAttributes['class'];
}>();

const emit = defineEmits<{
  (e: 'click', ev: MouseEvent): void;
}>();

defineOptions({
  name: 'UiAlertDialogAction',
});

function onClick(e: MouseEvent) {
  emit('click', e);
  setOpen(false);
}
</script>

<template>
  <button
    data-slot="alert-dialog-action"
    type="button"
    :class="[
      'bg-accent text-ink hover:bg-accent/90 focus-visible:border-ring focus-visible:ring-ring/50 inline-flex h-9 items-center justify-center rounded-md px-4 text-[13px] font-medium shadow-sm transition-colors outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50',
      props.class,
    ]"
    @click="onClick"
  >
    <slot />
  </button>
</template>
