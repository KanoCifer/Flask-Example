<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

const props = defineProps<{
  class?: HTMLAttributes['class'];
}>();

defineOptions({
  name: 'UiCardFooter',
});
</script>

<template>
  <div
    data-slot="card-footer"
    :class="['flex items-center px-6 [.border-t]:pt-6', props.class]"
  >
    <slot />
  </div>
</template>
