<template>
  <BentoCard class="group relative min-w-0 overflow-hidden">
    <!-- 背景渐变 -->
    <div
      class="absolute inset-0 bg-linear-to-br from-amber-500/10 via-transparent to-orange-500/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
    />

    <RouterLink
      to="/bookshelf"
      class="relative flex h-full flex-col justify-between p-1"
    >
      <!-- 顶部：图标和标题 -->
      <div class="flex items-start justify-between">
        <img
          src="/images/animal-badge/fox.png"
          alt="Fox"
          class="size-10 rounded-md object-cover"
        />
        <div class="flex -space-x-2">
          <div
            v-for="(color, i) in bookCovers"
            :key="i"
            :class="[
              'h-8 w-6 rounded shadow-sm transition-transform duration-300',
              color,
            ]"
            :style="{ transitionDelay: `${i * 50}ms` }"
          />
        </div>
      </div>

      <!-- 中部：统计信息 -->
      <div class="mt-3 space-y-2">
        <div class="flex items-baseline gap-1">
          <span class="text-ink text-2xl font-bold tracking-tight">{{
            displayCount
          }}</span>
          <span class="text-muted text-xs">本在读</span>
        </div>

        <!-- 阅读时长 -->
        <div class="space-y-1.5 text-[10px]">
          <div class="flex items-center justify-between">
            <span class="text-muted">本周</span>
            <span class="font-medium text-amber-600">{{
              formatDuration(weeklyMinutes)
            }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-muted">本月</span>
            <span class="font-medium text-amber-600">{{
              formatDuration(monthlyMinutes)
            }}</span>
          </div>
        </div>
      </div>
    </RouterLink>
  </BentoCard>
</template>

<script setup lang="ts">
import { BentoCard } from '@/components';
import { useAnimateNumber } from '@/composables';
import { useReadingSummary } from '@/features/books';
import { formatDuration } from '@/lib/dayjs';
import { BookOpen } from '@lucide/vue';
import { onMounted, watch } from 'vue';

const { displayValue: displayCount, animateTo } = useAnimateNumber();
const { readingCount, weeklyMinutes, monthlyMinutes, refresh } =
  useReadingSummary();
const bookCovers = ['bg-red-400', 'bg-blue-400', 'bg-green-400'];

watch(readingCount, (val) => animateTo(val));

onMounted(() => {
  refresh();
});
</script>
