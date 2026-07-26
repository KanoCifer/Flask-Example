<script setup lang="ts">
interface Props {
  totalCount: number;
  activeCount: number;
  monthlyEstimate: number;
  dueSoonCount: number;
  isLoading: boolean;
  isRefreshing: boolean;
}

defineProps<Props>();

const emit = defineEmits<{
  refresh: [];
  add: [];
}>();
</script>

<template>
  <section
    class="/80 bg-page rounded-[28px] border p-7 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.45)] backdrop-blur"
  >
    <div class="flex flex-wrap items-start justify-between gap-5">
      <div class="max-w-3xl">
        <p
          class="text-muted mb-2 text-xs font-semibold tracking-[0.2em] uppercase"
        >
          Subscription
        </p>
        <h2 class="text-ink font-serif text-3xl font-semibold">桌面订阅看板</h2>
        <p class="text-muted dark:text-muted mt-2 text-sm">
          参考移动端订阅卡片设计，重构为更适合桌面端的双栏结构，支持高密度信息查看与快速操作。
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <button
          type="button"
          :disabled="isLoading || isRefreshing"
          class="bg-page text-ink hover:bg-surface inline-flex items-center rounded-xl border px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60"
          @click="emit('refresh')"
        >
          {{ isRefreshing ? '刷新中...' : '刷新列表' }}
        </button>
        <button
          type="button"
          class="from-brand-devices hover:from-brand-devices to-brand-devices text-ink shadow-brand-devices/30 hover:to-brand-devices/80 inline-flex items-center rounded-xl bg-linear-to-r px-4 py-2.5 text-sm font-semibold shadow-lg transition"
          @click="emit('add')"
        >
          新增订阅
        </button>
        <RouterLink
          to="/device-tracker"
          class="bg-page text-ink hover:bg-surface inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="h-5 w-5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3m-3 9h3"
            />
          </svg>
          设备管理
        </RouterLink>
      </div>
    </div>

    <div class="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <article class="/80 bg-page/70 rounded-2xl border p-4">
        <p class="text-muted text-xs">总订阅数</p>
        <p class="text-ink mt-2 text-2xl font-semibold">
          {{ totalCount }}
        </p>
      </article>
      <article class="border-success/30 bg-success/20 rounded-2xl border p-4">
        <p class="text-success">活跃订阅</p>
        <p class="text-success mt-2 text-2xl font-semibold">
          {{ activeCount }}
        </p>
      </article>
      <article class="border-accent/30 bg-accent/20 rounded-2xl border p-4">
        <p class="text-ink">月度估算</p>
        <p class="text-ink mt-2 text-2xl font-semibold">
          ¥{{ monthlyEstimate.toFixed(2) }}
        </p>
      </article>
      <article class="border-warning/30 bg-warning/20 rounded-2xl border p-4">
        <p class="text-warning">7 天内到期</p>
        <p class="text-warning mt-2 text-2xl font-semibold">
          {{ dueSoonCount }}
        </p>
      </article>
    </div>
  </section>
</template>
