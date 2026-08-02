<template>
  <span
    class="border-border bg-surface text-muted inline-flex h-5 items-center rounded-full border px-2 font-mono text-[11px] font-medium tracking-[0.02em] whitespace-nowrap tabular-nums"
  >
    {{ slug }}
  </span>
</template>

<script setup lang="ts">
defineProps<{ slug: string }>();
</script>