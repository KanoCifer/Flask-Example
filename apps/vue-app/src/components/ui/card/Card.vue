<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

const props = defineProps<{
  class?: HTMLAttributes['class'];
}>();

defineOptions({
  name: 'UiCard',
});
</script>

<template>
  <div
    data-slot="card"
    :class="[
      'bg-card text-ink flex flex-col gap-6 rounded-xl border py-6 shadow-sm',
      props.class,
    ]"
  >
    <slot />
  </div>
</template>
