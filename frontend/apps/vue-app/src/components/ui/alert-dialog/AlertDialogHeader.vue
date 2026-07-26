<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

const props = defineProps<{
  class?: HTMLAttributes['class'];
}>();

defineOptions({
  name: 'UiAlertDialogHeader',
});
</script>

<template>
  <div
    data-slot="alert-dialog-header"
    :class="['flex flex-col gap-2 text-center sm:text-left', props.class]"
  >
    <slot />
  </div>
</template>
