<template>
  <span
    class="bg-surface text-muted rounded-full px-2.5 text-xs"
    :class="compact ? 'py-0.5' : 'py-1'"
  >
    <slot />
  </span>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false });
</script>
