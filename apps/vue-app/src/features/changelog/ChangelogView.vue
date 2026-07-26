<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { motion } from 'motion-v';
import { SPRING_REVEAL, WHILE_IN_VIEW_FADE_UP } from '@/constants';
import { changelogGateway } from '@/features/changelog/api/changelogGateway';
import type { Changelog } from '@/features/changelog/types';

const changelog = ref<Changelog[]>([]);

onMounted(async () => {
  changelog.value = await changelogGateway.getChangelogs();
});

const getTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    feat: '新功能',
    fix: '修复',
    refactor: '重构',
    style: '样式',
    docs: '文档',
    perf: '性能',
    test: '测试',
    chore: '构建',
  };
  return labels[type] || type;
};

const getTypeIcon = (type: string): string => {
  const icons: Record<string, string> = {
    feat: '✨',
    fix: '🐛',
    refactor: '♻️',
    style: '🎨',
    docs: '📝',
    perf: '⚡',
    test: '🧪',
    chore: '🔧',
  };
  return icons[type] || '';
};

const getTypeClass = (type: string): string => {
  const classes: Record<string, string> = {
    feat: 'bg-success/15 text-success ring-1 ring-success/30',
    fix: 'bg-destructive/15 text-destructive ring-1 ring-destructive/30',
    refactor: 'bg-chart-2/15 text-chart-2 ring-1 ring-chart-2/30',
    style: 'bg-chart-4/15 text-chart-4 ring-1 ring-chart-4/30',
    docs: 'bg-accent/15 text-ink ring-1 ring-accent/30',
    perf: 'bg-warning/15 text-warning ring-1 ring-warning/30',
    test: 'bg-chart-1/15 text-chart-1 ring-1 ring-chart-1/30',
    chore: 'bg-surface text-muted ring-1 ring-border/30',
  };
  return classes[type] ?? classes.chore ?? '';
};
</script>

<template>
  <div
    id="changelogView"
    class="my-12 flex min-h-screen w-full flex-col items-center justify-center py-12"
  >
    <div class="w-full max-w-6xl px-4">
      <!-- Header Section -->
      <div class="mb-16 text-center">
        <div
          class="bg-accent/15 text-ink mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
        >
          <svg
            class="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          版本更新记录
        </div>
        <h1 class="text-ink mb-4 text-5xl font-bold tracking-tight md:text-6xl">
          变更日志
        </h1>
        <p class="text-muted mx-auto max-w-2xl text-lg">
          记录网站的每一次成长与进步
        </p>
      </div>

      <!-- Timeline -->
      <div class="relative">
        <!-- Center timeline line -->
        <div
          class="absolute top-0 left-1/2 hidden h-full w-0.5 -translate-x-1/2 bg-linear-to-b from-blue-400 via-purple-400 to-pink-400 md:block"
        ></div>
        <div
          class="absolute top-0 left-3 hidden h-full w-px bg-linear-to-b from-blue-400 via-purple-400 to-pink-400"
        ></div>

        <!-- Releases -->
        <div class="space-y-12">
          <motion.div
            :initial="{ opacity: 0, y: 40 }"
            :whileInView="WHILE_IN_VIEW_FADE_UP"
            :transition="SPRING_REVEAL"
            v-for="(r, i) in changelog"
            :key="r.version"
            :class="[
              'relative flex items-center',
              i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse',
            ]"
          >
            <!-- Content Card -->
            <div class="-mx-8 w-full md:w-1/2">
              <div
                class="group squircle bg-page/80 cursor-pointer border p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl md:p-8"
              >
                <!-- Version Badge & Date -->
                <div class="mb-4 flex flex-wrap items-center gap-3">
                  <span
                    class="from-gradient-primary-from to-gradient-primary-to text-ink shadow-accent/25 inline-flex items-center gap-2 rounded-full bg-linear-to-r px-4 py-2 text-sm font-bold shadow-lg"
                  >
                    <svg
                      class="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                    v{{ r.version }}
                  </span>
                  <span class="text-muted flex items-center gap-1 text-sm">
                    <svg
                      class="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    {{ r.date }}
                  </span>
                </div>

                <!-- Release Title -->
                <h2 class="text-ink mb-4 text-2xl font-bold">
                  {{ r.title }}
                </h2>

                <!-- Changes List -->
                <ul class="space-y-3">
                  <li
                    v-for="(change, i) in r.changes"
                    :key="i"
                    class="flex items-start gap-3"
                  >
                    <span
                      :class="[
                        'mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold tracking-wide uppercase transition-all duration-200',
                        getTypeClass(change.type),
                      ]"
                    >
                      <span v-if="getTypeIcon(change.type)">{{
                        getTypeIcon(change.type)
                      }}</span>
                      {{ getTypeLabel(change.type) }}
                    </span>
                    <span class="text-ink">
                      {{ change.content }}
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            <!-- Timeline Dot -->
            <div
              class="absolute top-1/2 left-1/2 z-10 hidden h-8 w-8 -translate-x-1/2 -translate-y-1/2 md:block"
            >
              <div
                class="bg-accent absolute inset-0 -m-2 rounded-full opacity-30 blur-md transition-all duration-300 group-hover:opacity-50 group-hover:blur-lg"
              ></div>
              <div
                class="bg-page ring-accent/20 relative flex h-full w-full items-center justify-center rounded-full ring-4"
              >
                <div class="bg-accent h-3 w-3 rounded-full"></div>
              </div>
            </div>

            <!-- Mobile Timeline Dot -->
            <div
              class="absolute top-6 left-0 z-10 h-6 w-6 -translate-x-1/2 md:hidden"
            >
              <div
                class="bg-page ring-accent/20 relative flex h-full w-full items-center justify-center rounded-full ring-3"
              >
                <div class="bg-accent h-2 w-2 rounded-full"></div>
              </div>
            </div>

            <!-- Spacer for alignment -->
            <div class="hidden md:block md:w-5/12"></div>
          </motion.div>
        </div>
      </div>
    </div>
  </div>
</template>
