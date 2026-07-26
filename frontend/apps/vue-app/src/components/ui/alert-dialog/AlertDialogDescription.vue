<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { inject } from 'vue';

const describedBy = inject<string | undefined>(
  'alertDialog.describedBy',
  undefined,
);

const props = defineProps<{
  class?: HTMLAttributes['class'];
}>();

defineOptions({
  name: 'UiAlertDialogDescription',
});
</script>

<template>
  <p
    data-slot="alert-dialog-description"
    :id="describedBy"
    :class="['text-muted text-sm', props.class]"
  >
    <slot />
  </p>
</template>
