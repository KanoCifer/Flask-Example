<script setup lang="ts">
/**
 * 弹窗标题。注入 Content 的 labelledBy id 用于 a11y。
 */
import type { HTMLAttributes } from 'vue';
import { inject } from 'vue';

const labelledBy = inject<string | undefined>(
  'alertDialog.labelledBy',
  undefined,
);

const props = defineProps<{
  class?: HTMLAttributes['class'];
}>();

defineOptions({
  name: 'UiAlertDialogTitle',
});
</script>

<template>
  <h2
    data-slot="alert-dialog-title"
    :id="labelledBy"
    :class="['text-lg font-semibold', props.class]"
  >
    <slot />
  </h2>
</template>
