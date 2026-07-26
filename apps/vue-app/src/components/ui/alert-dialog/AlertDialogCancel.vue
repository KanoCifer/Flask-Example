<script setup lang="ts">
/**
 * 取消按钮。点击时关闭弹窗。
 * 用 form method="dialog" 也能在内部任意位置关闭（浏览器会触发 close 事件），
 * 但这里我们用显式 setOpen(false) 保持可预测。
 */
import type { HTMLAttributes } from 'vue';
import { inject } from 'vue';

const setOpen = inject<(v: boolean) => void>('alertDialog.setOpen', () => {});

const props = defineProps<{
  class?: HTMLAttributes['class'];
}>();

defineOptions({
  name: 'UiAlertDialogCancel',
});

function onClick() {
  setOpen(false);
}
</script>

<template>
  <button
    data-slot="alert-dialog-cancel"
    type="button"
    :class="[
      'bg-page hover:bg-surface hover:text-ink focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 dark:border-input dark:hover:bg-input/50 inline-flex h-9 items-center justify-center rounded-md border px-4 text-[13px] font-medium shadow-xs transition-colors outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 sm:mt-0',
      props.class,
    ]"
    @click="onClick"
  >
    <slot />
  </button>
</template>
