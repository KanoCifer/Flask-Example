<template>
  <div
    class="/40 bg-page/60 mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-dashed px-6 py-12 text-center"
  >
    <div
      class="bg-surface text-muted flex h-12 w-12 items-center justify-center rounded-full"
      aria-hidden="true"
    >
      <MessageCircleHeart />
    </div>
    <div>
      <h3 class="text-ink font-serif text-lg">
        {{ title }}
      </h3>
      <p class="text-muted mt-1 text-sm">
        {{ description }}
      </p>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { MessageCircleHeart } from '@lucide/vue';
withDefaults(
  defineProps<{
    title?: string;
    description?: string;
  }>(),
  {
    title: '还没有碎碎念',
    description: '等到想写一句的时候，再来吧。',
  },
);
</script>
