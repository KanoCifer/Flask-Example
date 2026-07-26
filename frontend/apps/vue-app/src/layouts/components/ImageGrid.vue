<script setup lang="ts">
import type { BackgroundOption } from '@/stores';

defineProps<{
  images: BackgroundOption[];
  selected: number;
}>();

defineEmits<{
  (e: 'select', index: number): void;
}>();
</script>

<template>
  <div class="grid grid-cols-2 gap-3">
    <button
      v-for="(bg, index) in images"
      :key="bg.id"
      @click="$emit('select', index)"
      class="hover:border-accent relative overflow-hidden rounded-xl border-2 transition-all"
      :class="{ 'border-accent': selected === index }"
    >
      <img :src="bg.url" :alt="bg.name" class="h-24 w-full object-cover" />
      <div
        v-if="selected === index"
        class="absolute inset-0 flex items-center justify-center bg-black/30"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div
        class="bg-page/80 absolute right-2 bottom-2 rounded-md px-2 py-0.5 text-xs backdrop-blur-sm"
      >
        {{ index + 1 }}
      </div>
    </button>
  </div>
</template>
