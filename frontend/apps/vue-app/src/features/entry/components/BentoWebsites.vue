<template>
  <div
    class="relative flex h-full w-3xs flex-col justify-between px-6 py-4"
    @click="$router.push('/websites')"
  >
    <div
      class="text-muted group-hover:text-ink text-xs font-bold tracking-wide uppercase transition-colors duration-300"
    >
      Daily Pick
    </div>
    <div class="my-1 flex items-center">
      <div
        class="bg-surface text-muted group-hover:bg-secondary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors duration-300"
      >
        <img
          v-if="randomSite?.icon"
          :src="randomSite.icon"
          :alt="randomSite?.name"
          class="h-6 w-6 object-contain"
          @error="handleImageError"
        />
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          class="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0 3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
          />
        </svg>
      </div>
      <h3
        class="text-ink group-hover:text-ink ml-2 text-lg leading-tight font-bold transition-colors duration-300"
      >
        {{ randomSite?.name || '加载中...' }}
      </h3>
    </div>
    <div>
      <p
        class="text-muted group-hover:text-ink line-clamp-2 text-sm transition-colors duration-300"
      >
        {{ randomSite?.description || '正在获取推荐网站...' }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { websitesData } from '@/data';
import type { Website } from '@/features/websites';
import { useImageError } from '@/composables';

const { handleImageError } = useImageError();

const randomSite: Website | null =
  websitesData.sites.length > 0
    ? websitesData.sites[Math.floor(Math.random() * websitesData.sites.length)]
    : null;
</script>
