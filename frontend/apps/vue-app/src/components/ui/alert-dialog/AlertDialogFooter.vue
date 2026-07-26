<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

const props = defineProps<{
  class?: HTMLAttributes['class'];
}>();

defineOptions({
  name: 'UiAlertDialogFooter',
});
</script>

<template>
  <div
    data-slot="alert-dialog-footer"
    :class="[
      'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
      props.class,
    ]"
  >
    <slot />
  </div>
</template>
