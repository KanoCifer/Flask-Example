<script setup lang="ts">
/**
 * 触发器：把点击事件转发到 provide 的 setOpen(true)。
 * - 当默认 slot 有内容时直接渲染（通常是一个 button）。
 * - `as-child` 只是 shadcn 兼容语法，行为上等价——slot 内容包在 click 下即可。
 */
import { inject } from 'vue';

const setOpen = inject<(v: boolean) => void>('alertDialog.setOpen', () => {});

defineOptions({
  name: 'UiAlertDialogTrigger',
});
</script>

<template>
  <span
    v-if="$slots.default"
    data-slot="alert-dialog-trigger"
    role="button"
    tabindex="0"
    @click="setOpen(true)"
    @keydown.enter.prevent="setOpen(true)"
    @keydown.space.prevent="setOpen(true)"
  >
    <slot />
  </span>
</template>
