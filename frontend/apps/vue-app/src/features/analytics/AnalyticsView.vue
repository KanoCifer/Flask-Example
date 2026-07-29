<template>
  <div class="bg-page min-h-screen">
    <!-- Page header — literary register via Averia + Dongfang display -->
    <header class="mx-auto max-w-6xl px-6 pt-10 sm:px-8 sm:pt-14">
      <div class="bg-accent/40 mb-4 h-px w-8"></div>
      <div class="flex items-center gap-3">
        <span
          class="bg-surface text-muted inline-block rounded-full px-2.5 py-0.5 font-mono text-[10px] font-medium tracking-[0.18em] uppercase"
        >
          仅管理员
        </span>
      </div>
      <h1 class="text-ink font-family-dongfang mt-3 text-3xl sm:text-4xl">
        访客 · 趋势
      </h1>
      <p class="text-muted font-family-averia mt-1.5 text-base">
        Reading Space · Analytics
      </p>
      <p class="text-muted mt-1 text-sm">书房访客与近期阅读趋势一览</p>
    </header>

    <!-- Dashboard grid -->
    <main class="mx-auto max-w-6xl px-6 pb-16 sm:px-8">
      <!-- Filter row -->
      <div class="mt-8">
        <div
          class="bg-card flex flex-col items-center justify-between gap-3 rounded-2xl border p-3 sm:flex-row"
        >
          <!-- Days Filter: segmented control (radio group) -->
          <div
            role="radiogroup"
            aria-label="日期范围"
            class="bg-secondary flex rounded-xl p-1"
          >
            <button
              v-for="option in [7, 30, 90]"
              :key="option"
              type="button"
              role="radio"
              :aria-checked="selectedDays === option"
              class="rounded-lg px-4 py-1.5 text-sm font-medium transition-colors"
              :class="
                selectedDays === option
                  ? 'bg-page text-ink shadow-sm'
                  : 'text-muted hover:text-ink'
              "
              @click="selectedDays = option"
            >
              {{ option }} 天
            </button>
          </div>

          <!-- Refresh Button -->
          <Button
            :disabled="loading && !!overviewData"
            @click="fetchAllData"
            size="md"
          >
            <svg
              :class="[
                loading && !overviewData ? 'animate-spin' : '',
                'h-4 w-4 transition-transform',
              ]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {{ loading && !overviewData ? '加载中…' : '刷新' }}
          </Button>
        </div>
      </div>

      <!-- Primary: 3 stat tiles + trend chart -->
      <div
        class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3"
        :class="{
          'pointer-events-none opacity-60 transition-opacity duration-200':
            loading && !!overviewData,
        }"
      >
        <!-- Error (spans full row inside the dashboard grid) -->
        <div v-if="error" class="col-span-1 lg:col-span-3">
          <div
            class="bg-destructive/5 border-destructive/20 text-destructive rounded-2xl border p-4"
          >
            <div class="flex items-center gap-2">
              <svg
                class="h-5 w-5 shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fill-rule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clip-rule="evenodd"
                />
              </svg>
              {{ error }}
            </div>
          </div>
        </div>

        <!-- 3 stat tiles: align-baseline with matching heights -->
        <div class="col-span-1 lg:col-span-3">
          <SkeletonCrossfadeTransition>
            <div
              v-if="loading && !overviewData"
              key="loading"
              class="grid grid-cols-1 gap-4 sm:grid-cols-3"
            >
              <div
                v-for="i in 3"
                :key="i"
                class="bg-surface/50 h-24 animate-pulse rounded-2xl"
              ></div>
            </div>
            <div
              v-else-if="overviewData"
              key="data"
              class="grid grid-cols-1 gap-4 sm:grid-cols-3"
            >
              <StatTile
                label="总访问量"
                :value="overviewData.total_visits"
                :sparkline="sparklinePoints"
                sparkline-class="text-ink"
                accent="bg-accent/10 text-ink"
              >
                <template #icon>
                  <svg
                    class="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                </template>
              </StatTile>

              <StatTile
                label="独立访客"
                :value="overviewData.unique_visitors"
                :sparkline="uvSparklinePoints"
                sparkline-class="text-success"
                accent="bg-success/10 text-success"
              >
                <template #icon>
                  <svg
                    class="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </template>
              </StatTile>

              <StatTile
                label="日均访问"
                :value="avgVisitsPerDay"
                value-suffix=""
                :sparkline="avgSparklinePoints"
                sparkline-class="text-warning"
                accent="bg-warning/10 text-warning"
              >
                <template #icon>
                  <svg
                    class="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </template>
                <template #footer>
                  <span class="text-muted text-xs">
                    最近 {{ selectedDays }} 天
                  </span>
                </template>
              </StatTile>
            </div>
          </SkeletonCrossfadeTransition>
        </div>

        <!-- Trend chart: full row -->
        <div class="col-span-1 lg:col-span-3">
          <TrendChartCard
            :loading="loading"
            :overview-data="overviewData"
            :selected-days="selectedDays"
          />
        </div>

        <!-- Secondary: Popular Pages -->
        <div class="col-span-1 lg:col-span-2">
          <PopularPagesChartCard
            :loading="loading"
            :overview-data="overviewData"
          />
        </div>

        <!-- Secondary: Post Views -->
        <div class="col-span-1 lg:col-span-1">
          <PostViewsChartCard :loading="loading" :data="postViewsData" />
        </div>

        <!-- Collapsed secondary: 设备 & 浏览器 -->
        <div class="col-span-1 lg:col-span-3">
          <div class="bg-card overflow-hidden rounded-3xl border">
            <button
              type="button"
              class="text-ink hover:bg-surface/30 flex w-full items-center justify-between px-6 py-4 text-left transition-colors"
              :aria-expanded="showOsBrowser"
              aria-controls="os-browser-panel"
              @click="showOsBrowser = !showOsBrowser"
            >
              <span class="flex items-center gap-2 text-sm font-medium">
                <icon-analytics class="text-muted size-4" />
                设备 & 浏览器分布
              </span>
              <svg
                class="text-muted h-4 w-4 transition-transform"
                :class="{ 'rotate-180': showOsBrowser }"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            <div
              id="os-browser-panel"
              class="grid transition-[grid-template-rows] duration-200 ease-out"
              :class="[showOsBrowser ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]']"
            >
              <div class="col-span-1 min-h-0 overflow-hidden sm:col-span-2">
                <div class="grid grid-cols-1 gap-4 px-6 pb-6 sm:grid-cols-2">
                  <OsCharts
                    :loading="loading"
                    :os-stats="overviewData?.os_stats ?? []"
                  />
                  <BrowserAnalytics
                    :loading="loading"
                    :browser-stats="overviewData?.browser_stats ?? []"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Server Monitor: collapsed status bar by default -->
        <div class="col-span-1 lg:col-span-3">
          <ServerMonitor
            ref="serverMonitorRef"
            :auto-start="true"
            :default-collapsed="true"
            custom-class="rounded-3xl"
          />
        </div>

        <!-- Login Logs Table -->
        <div class="col-span-1 lg:col-span-3">
          <div class="bg-card overflow-hidden rounded-3xl border p-5">
            <h2
              class="text-ink mb-4 flex items-center gap-2 text-sm font-medium"
            >
              <icon-user class="text-muted inline-block size-4" />
              用户登录记录
            </h2>

            <SkeletonCrossfadeTransition>
              <!-- Loading -->
              <div v-if="loading && !loginLogsData" key="loading" class="py-8">
                <div class="space-y-3">
                  <div
                    v-for="i in 5"
                    :key="i"
                    class="bg-surface h-12 animate-pulse rounded-lg"
                  ></div>
                </div>
              </div>

              <!-- Empty -->
              <div
                v-else-if="loginLogsData?.list.length === 0"
                key="empty"
                class="text-muted py-12 text-center text-sm"
              >
                <p>暂无登录记录</p>
              </div>

              <!-- Table -->
              <div v-else>
                <div class="overflow-x-auto">
                  <table class="w-full">
                    <caption class="sr-only">
                      用户登录记录表
                    </caption>
                    <thead>
                      <tr class="text-muted border-b text-left text-sm">
                        <th scope="col" class="pb-3 font-medium">用户</th>
                        <th scope="col" class="pb-3 font-medium">登录次数</th>
                        <th scope="col" class="pb-3 font-medium">最近登录</th>
                        <th scope="col" class="pb-3 font-medium">本次登录</th>
                        <th scope="col" class="pb-3 font-medium">最近 IP</th>
                        <th scope="col" class="pb-3 font-medium">本次 IP</th>
                      </tr>
                    </thead>
                    <tbody class="divide-border divide-y">
                      <tr
                        v-for="log in loginLogsData?.list ?? []"
                        :key="log.user_id"
                        class="hover:bg-surface/30 text-sm transition-colors"
                      >
                        <td class="py-3.5">
                          <div class="flex items-center gap-3">
                            <div
                              class="bg-accent/15 text-ink flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium"
                            >
                              {{ log.username?.charAt(0).toUpperCase() }}
                            </div>
                            <div>
                              <p class="text-ink font-medium">
                                {{ log.name || log.username }}
                              </p>
                              <p class="text-muted text-xs">
                                @{{ log.username }}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td class="py-3.5">
                          <span
                            class="bg-success/20 text-success inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums"
                          >
                            {{ log.login_count }}
                          </span>
                        </td>
                        <td class="text-ink/80 py-3.5 tabular-nums">
                          {{ formatDateTime(log.last_login_at) }}
                        </td>
                        <td class="text-ink/80 py-3.5 tabular-nums">
                          {{ formatDateTime(log.current_login_at) }}
                        </td>
                        <td
                          class="text-muted py-3.5 font-mono text-xs tabular-nums"
                        >
                          {{ log.last_login_ip || '-' }}
                        </td>
                        <td
                          class="text-muted py-3.5 font-mono text-xs tabular-nums"
                        >
                          {{ log.current_login_ip || '-' }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- Pagination -->
                <div
                  v-if="loginLogsData && loginLogsData.total_pages > 1"
                  class="mt-4 flex items-center justify-between border-t pt-4"
                >
                  <p class="text-muted text-sm">
                    显示第
                    {{ (loginLogsData.page - 1) * loginLogsData.page_size + 1 }}
                    至
                    {{
                      Math.min(
                        loginLogsData.page * loginLogsData.page_size,
                        loginLogsData.total,
                      )
                    }}
                    条，共 {{ loginLogsData.total }} 条
                  </p>
                  <div class="flex gap-2">
                    <button
                      :disabled="
                        loginLogsData.page <= 1 ||
                        (!!loading && !!loginLogsData)
                      "
                      :aria-label="`上一页，第 ${loginLogsData.page - 1} 页`"
                      @click="changePage(loginLogsData.page - 1)"
                      class="hover:bg-surface text-ink rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      上一页
                    </button>
                    <button
                      :disabled="
                        loginLogsData.page >= loginLogsData.total_pages ||
                        (!!loading && !!loginLogsData)
                      "
                      :aria-label="`下一页，第 ${loginLogsData.page + 1} 页`"
                      @click="changePage(loginLogsData.page + 1)"
                      class="hover:bg-surface text-ink rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      下一页
                    </button>
                  </div>
                </div>
              </div>
            </SkeletonCrossfadeTransition>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import {
  IconUser,
  IconAnalytics,
  SkeletonCrossfadeTransition,
} from '@/components';
import { analyticsGateway } from '@readinglist/api';
import type { PostViewData } from '@/features/analytics/types';
import { useAuthStore } from '@/features/auth';
import dayjs from 'dayjs';
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import TrendChartCard from './components/TrendChartCard.vue';
import BrowserAnalytics from './components/BrowserAnalytics.vue';
import OsCharts from './components/OsCharts.vue';
import PopularPagesChartCard from './components/PopularPagesChartCard.vue';
import PostViewsChartCard from './components/PostViewsChartCard.vue';
import ServerMonitor from './components/ServerMonitor.vue';
import StatTile from './components/StatTile.vue';
import { Button } from '@/components';

// Types
interface OverviewData {
  total_visits: number;
  unique_visitors: number;
  unique_visitor_ids: number;
  top_pages: { page_path: string; count: number }[];
  browser_stats: {
    browser_name: string;
    browser_version: string;
    count: number;
  }[];
  os_stats: { os_name: string; count: number }[];
  daily_trend: { date: string; count: number }[];
  period_days: number;
}

interface LoginLog {
  user_id: number;
  username: string;
  name: string | null;
  login_count: number;
  last_login_at: string | null;
  current_login_at: string | null;
  last_login_ip: string | null;
  current_login_ip: string | null;
  active: boolean;
}

interface LoginLogsResponse {
  list: LoginLog[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

defineOptions({
  name: 'AnalyticsView',
});

const auth = useAuthStore();
const router = useRouter();

const loading = ref<boolean>(false);
const error = ref<string | null>(null);
const selectedDays = ref(7);
const overviewData = ref<OverviewData | null>(null);
const loginLogsData = ref<LoginLogsResponse | null>(null);
const postViewsData = ref<PostViewData[] | null>(null);
const loginLogsPage = ref(1);
const showOsBrowser = ref<boolean>(false);

// Computed
const avgVisitsPerDay = computed(() => {
  if (!overviewData.value?.total_visits || !selectedDays.value) return '0';
  const avg = overviewData.value.total_visits / selectedDays.value;
  if (avg >= 1000) return (avg / 1000).toFixed(1) + 'K';
  return avg.toFixed(1);
});

/** 14-point series for sparklines (sorted asc by date). */
const buildSparkline = (points: number[]) => {
  if (points.length === 0) return [] as number[];
  const target = Math.max(7, Math.min(points.length, 14));
  if (points.length >= target) return points.slice(-target);
  const pad = Array.from({ length: target - points.length }, () => 0);
  return [...pad, ...points];
};

const dailyCounts = computed(() => {
  const trend = overviewData.value?.daily_trend ?? [];
  if (trend.length === 0) return [] as number[];
  const sorted = [...trend].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  return sorted.map((d) => d.count);
});

const sparklinePoints = computed(() => buildSparkline(dailyCounts.value));
const uvSparklinePoints = computed(() => buildSparkline(dailyCounts.value));
const avgSparklinePoints = computed(() => buildSparkline(dailyCounts.value));

// Methods
const formatDateTime = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm');
};

const fetchOverview = async () => {
  try {
    const res = await analyticsGateway.getOverview(selectedDays.value);
    overviewData.value = res.data as unknown as OverviewData;
  } catch (err) {
    console.error('Failed to fetch overview:', err);
    error.value = '加载概览数据失败，请重试。';
  }
};

const fetchPostViews = async () => {
  try {
    const res = await analyticsGateway.getPostViews();
    postViewsData.value = res.data as unknown as PostViewData[];
  } catch (err) {
    console.error('Failed to fetch post views:', err);
    error.value = '加载文章阅读量失败，请重试。';
  }
};

const fetchLoginLogs = async () => {
  try {
    const res = await analyticsGateway.getUserLogins({
      days: selectedDays.value,
      page: loginLogsPage.value,
      page_size: 20,
    });
    loginLogsData.value = res.data as unknown as LoginLogsResponse;
  } catch (err) {
    console.error('Failed to fetch login logs:', err);
    error.value = '加载登录记录失败，请重试。';
  }
};

const fetchAllData = async () => {
  loading.value = true;
  error.value = '';
  try {
    await Promise.all([fetchOverview(), fetchPostViews(), fetchLoginLogs()]);
  } finally {
    loading.value = false;
  }
};

const changePage = (page: number) => {
  if (loading.value) return;
  loginLogsPage.value = page;
  fetchLoginLogs();
};

// Watch for days selection change
watch(
  selectedDays,
  (newVal, oldVal) => {
    if (newVal === oldVal) return;
    loginLogsPage.value = 1;
    fetchAllData();
  },
  { flush: 'pre' },
);

// Lifecycle
onMounted(async () => {
  // Check auth
  if (auth.user === null && !auth.loading) {
    await auth.fetchUser();
  }

  if (!auth.isAuthenticated || auth.user?.id !== 1) {
    router.push('/');
    return;
  }

  await fetchAllData();
});

onUnmounted(() => {
  // no manual listeners to clean up
});
</script>
