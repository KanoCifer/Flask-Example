<template>
  <PageHero
    title="我的书架"
    eyebrow="微信读书"
    :subtitle="metaLine"
    back-fallback="/"
    size="md"
  >
    <template #actions>
      <Button
        variant="ghost"
        size="icon"
        :disabled="isSyncing"
        aria-label="同步书架"
        class="bg-page/60 hover:bg-secondary text-ink h-10 w-10 !rounded-full border backdrop-blur-md"
        @click="$emit('sync')"
      >
        <CloudSync class="h-5 w-5" :class="{ 'animate-breathe': isSyncing }" />
      </Button>
    </template>
    <template #ribbon>
      <slot name="ribbon" />
    </template>
  </PageHero>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { CloudSync } from '@lucide/vue';
import { Button, PageHero } from '@/components';

const props = withDefaults(
  defineProps<{
    bookCount: number | null;
    isSyncing: boolean;
  }>(),
  { bookCount: null, isSyncing: false },
);

defineEmits<{
  (e: 'sync'): void;
}>();

/** 副标题:N 本书 / null 时只留 eyebrow,无 dot */
const metaLine = computed<string | undefined>(() => {
  if (props.bookCount === null) return undefined;
  return `${props.bookCount} 本书`;
});
</script>
