<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

const props = defineProps<{
  class?: HTMLAttributes['class'];
}>();

defineOptions({
  name: 'UiCardTitle',
});
</script>

<template>
  <h3
    data-slot="card-title"
    :class="['leading-none font-semibold', props.class]"
  >
    <slot />
  </h3>
</template>
