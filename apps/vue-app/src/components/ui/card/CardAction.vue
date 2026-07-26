<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

const props = defineProps<{
  class?: HTMLAttributes['class'];
}>();

defineOptions({
  name: 'UiCardAction',
});
</script>

<template>
  <div
    data-slot="card-action"
    :class="[
      'col-start-2 row-span-2 row-start-1 self-start justify-self-end',
      props.class,
    ]"
  >
    <slot />
  </div>
</template>
