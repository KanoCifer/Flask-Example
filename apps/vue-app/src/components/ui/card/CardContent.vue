<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

const props = defineProps<{
  class?: HTMLAttributes['class'];
}>();

defineOptions({
  name: 'UiCardContent',
});
</script>

<template>
  <div data-slot="card-content" :class="['px-6', props.class]">
    <slot />
  </div>
</template>
