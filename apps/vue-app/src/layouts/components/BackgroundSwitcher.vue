<template>
  <div ref="dropdownRef" class="relative">
    <button
      @click.stop="isOpen = !isOpen"
      class="squircle hover:bg-surface rounded-xl p-2 transition-[background-color,transform] hover:scale-110"
      title="选择背景图"
    >
      <svg
        class="text-ink h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    </button>

    <DropdownTransition>
      <div
        v-if="isOpen"
        class="bg-page absolute top-full right-0 z-9999 mt-2 w-48 rounded-lg shadow-lg"
        @click.stop
      >
        <!-- Random 选项 -->
        <button
          @click="handleRandom"
          class="text-ink hover:bg-surface flex w-full cursor-pointer items-center gap-3 rounded-t-lg px-3 py-2.5 text-sm transition-colors"
          :class="{ 'bg-surface': store.mode === 'random' }"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="16 3 21 3 21 8" />
            <line x1="4" y1="20" x2="21" y2="3" />
            <polyline points="21 16 21 21 16 21" />
            <line x1="15" y1="15" x2="21" y2="21" />
            <line x1="4" y1="4" x2="9" y2="9" />
          </svg>
          <span class="flex-1">Random</span>
          <svg
            v-if="store.mode === 'random'"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="text-ink"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>

        <div class="mx-2 border-t" />

        <div class="max-h-60 overflow-y-auto">
          <button
            v-for="(bg, index) in store.backgrounds"
            :key="bg.id"
            @click="store.selectFixed(index)"
            class="text-ink hover:bg-surface flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-sm transition-colors"
            :class="{
              'bg-surface':
                store.mode === 'fixed' && store.fixedIndex === index,
              'rounded-b-lg': index === store.backgrounds.length - 1,
            }"
          >
            <img
              :src="bg.url"
              :alt="bg.name"
              class="flex-shrink-0 rounded-md object-cover"
              style="width: 40px; height: 24px"
            />
            <span class="flex-1 text-left">{{ bg.name }}</span>
            <svg
              v-if="store.mode === 'fixed' && store.fixedIndex === index"
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-ink"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
        </div>
      </div>
    </DropdownTransition>
  </div>
</template>

<script setup lang="ts">
import { DropdownTransition } from '@/components';
import { onMounted, onUnmounted, ref } from 'vue';
import { useBackgroundStore } from '@/stores';

const store = useBackgroundStore();

const isOpen = ref(false);
const dropdownRef = ref<HTMLElement | null>(null);

const handleRandom = () => {
  // 已在 random 模式时再次点击触发重新随机
  store.randomize();
  isOpen.value = false;
};

const handleClickOutside = (event: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>
