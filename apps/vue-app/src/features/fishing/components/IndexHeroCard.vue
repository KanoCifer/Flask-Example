<script setup lang="ts">
import { useFishingMapStore } from '@/features/fishing/stores/fishingMap';
import type { FishingIndexData } from '@/features/fishing/types';
import DashboardCard from '@/features/fishing/components/DashboardCard.vue';
import { ChevronRight, FishingRod, Loader, MapPin } from '@lucide/vue';
import { storeToRefs } from 'pinia';
import { ref, watch } from 'vue';
import { Button } from '@/components';
import { useAnimateNumber } from '@/composables';

/**
 * Hero 钓鱼指数卡。
 *
 * - 数据来源：fishingMap store（dashboard 主流）
 * - 不再持有 location prop —— 刷新由父级 dashboard composable 调度，
 *   保证用 activeLocation（用户定位 / 默认中心）而不是组件局部默认值
 * - 视觉层次：Hero 大数字 → 三联 prose → 特征详情 → footer (定位) → 操作按钮 (锚底)
 */
const emit = defineEmits<{
  'feedback-click': [data: FishingIndexData];
  refresh: [];
}>();

const fishingMapStore = useFishingMapStore();
const {
  indexData,
  indexLoading: loading,
  indexError: error,
  locationName,
} = storeToRefs(fishingMapStore);

/** 顶部大数字配色 (text-* 语义 token) */
const levelTextColor: Record<string, string> = {
  爆护: 'text-success',
  好: 'text-ink',
  一般: 'text-warning',
  差: 'text-destructive',
  空军: 'text-muted',
};

/**
 * Gauge 进度条配色 —— 用 Tailwind gradient + 语义 token,避免硬编码 hex
 * 这里只决定 class,实际宽度仍走 inline style (因为依赖运行时 value)
 */
const gaugeGradientClass = (percentage: number): string => {
  if (percentage >= 85) return 'bg-gradient-to-r from-success/70 to-success';
  if (percentage >= 70) return 'bg-gradient-to-r from-accent/70 to-accent';
  if (percentage >= 50) return 'bg-gradient-to-r from-warning/70 to-warning';
  if (percentage <= 30)
    return 'bg-gradient-to-r from-destructive/70 to-destructive';
  return 'bg-gradient-to-r from-accent/50 to-accent/90';
};

const formatFeatureName = (name: string): string => {
  const mapping: Record<string, string> = {
    w1_temp: '气温',
    w2_humidity: '湿度',
    w3_pressure: '气压',
    w4_wind: '风速',
    w5_rain: '降水',
    w6_tide_rising: '涨潮',
    w7_hours_to_tide: '距潮',
    w8_tide_range: '潮差',
    w9_indices: '指数',
  };
  return mapping[name] || name;
};

const handleFeedback = () => {
  if (indexData.value) emit('feedback-click', indexData.value);
};

/** 特征详情折叠状态 (false = 默认展开,与原 `<details open>` 行为一致) */
const featureCollapsed = ref(false);

/**
 * Hero 大数字滚动动画 —— 复用 useAnimateNumber,数据到位/刷新时从 0 缓动到目标值,
 * 与水波浮漂母题呼应(数字「浮上来」)。immediate 覆盖首屏已有数据的场景。
 */
const { displayValue: displayIndex, animateTo } = useAnimateNumber();
watch(
  () => indexData.value?.fishing_index,
  (val) => {
    if (typeof val === 'number') animateTo(val);
  },
  { immediate: true },
);
</script>

<template>
  <DashboardCard tone="hero" padding="default" class="group">
    <!-- 标题 + 刷新 + 图标 -->
    <div class="mb-5 flex items-start justify-between gap-3">
      <div>
        <h3 class="text-ink font-serif text-lg font-semibold">钓鱼指数</h3>
        <p class="text-muted mt-0.5 text-sm">基于天气、潮汐综合计算</p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <Button
          variant="ghost"
          type="button"
          size="sm"
          :disabled="loading"
          @click="emit('refresh')"
        >
          <Loader v-if="loading" class="h-3 w-3 animate-spin" />
          {{ loading ? '刷新中' : '刷新' }}
        </Button>
      </div>
    </div>

    <!-- 主数据 / loading / error -->
    <p v-if="loading && !indexData" class="text-muted text-sm">加载中...</p>
    <p v-else-if="error && !indexData" class="text-destructive text-sm">
      {{ error }}
    </p>
    <template v-else-if="indexData">
      <!-- Hero 数字:主导视觉,撑满卡片上半部。数字如浮漂,坐落于水波之上 -->
      <div class="hero-number relative flex items-end gap-3">
        <span class="hero-ripple" aria-hidden="true">
          <i></i><i></i><i></i>
        </span>
        <span
          class="relative z-[1] text-7xl leading-none font-bold tracking-tight tabular-nums"
          :class="levelTextColor[indexData.level] || 'text-muted'"
        >
          {{ displayIndex }}
        </span>
        <span
          class="relative z-[1] mb-2 text-base font-medium"
          :class="levelTextColor[indexData.level] || 'text-muted'"
        >
          {{ indexData.level }}
        </span>
        <FishingRod
          class="hero-rod mr-2 ml-auto size-20 opacity-70"
          :class="levelTextColor[indexData.level] || 'text-muted'"
        />
      </div>

      <!-- 三联指标 (扁平 prose 行:label · value · label · value) -->
      <div
        class="text-muted mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs"
      >
        <span>默认权重</span>
        <span class="text-ink font-medium tabular-nums">
          {{ indexData.expert_score }}
        </span>
        <span aria-hidden="true">·</span>
        <span>权重调整</span>
        <span class="text-ink font-medium tabular-nums">
          {{ indexData.residual > 0 ? '+' : '' }}{{ indexData.residual }}
        </span>
        <span aria-hidden="true">·</span>
        <span>综合</span>
        <span class="text-ink font-medium tabular-nums">
          {{ indexData.fishing_index }}
        </span>
      </div>

      <!-- 特征详情 (扁平 3×N + grid-row 0fr↔1fr 平滑折叠) -->
      <div
        v-if="Object.keys(indexData.feature_breakdown).length > 0"
        class="mt-6 text-xs"
      >
        <button
          type="button"
          class="text-muted hover:text-ink inline-flex cursor-pointer items-center gap-1 select-none"
          :aria-expanded="!featureCollapsed"
          aria-controls="hero-feature-breakdown"
          @click="featureCollapsed = !featureCollapsed"
        >
          <ChevronRight
            class="h-3 w-3 transition-transform duration-300 ease-out"
            :class="!featureCollapsed && 'rotate-90'"
          />
          特征详情
        </button>
        <div
          id="hero-feature-breakdown"
          class="feature-collapse mt-2 grid"
          :class="featureCollapsed ? 'is-collapsed' : ''"
        >
          <div class="feature-collapse-inner">
            <div class="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-3">
              <div
                v-for="(value, keyName) in indexData.feature_breakdown"
                :key="keyName"
              >
                <div class="mb-0.5 flex items-baseline justify-between gap-2">
                  <span class="text-ink">{{ formatFeatureName(keyName) }}</span>
                  <span class="text-muted tabular-nums">{{
                    Math.round(value * 100)
                  }}</span>
                </div>
                <div
                  class="bg-surface relative h-1.5 w-full overflow-hidden rounded-full"
                >
                  <div
                    class="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                    :class="gaugeGradientClass(Math.round(value * 100))"
                    :style="{ width: `${Math.round(value * 100)}%` }"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer:定位 (store 真实字段) -->
      <p
        v-if="locationName"
        class="text-muted border-border mt-6 flex items-center gap-1.5 border-t pt-4 text-xs"
      >
        <MapPin class="h-3 w-3 shrink-0" />
        <span class="truncate">{{ locationName }}</span>
        <span aria-hidden="true" class="opacity-60">·</span>
        <span class="whitespace-nowrap">实时计算</span>
      </p>

      <!-- 提交按钮 (锚定卡片底部,继承 DashboardCard 的 flex h-full) -->
      <Button size="lg" class="mt-auto w-full" @click="handleFeedback">
        提交钓鱼反馈
      </Button>
    </template>
    <p v-else class="text-muted text-sm">暂无数据</p>
  </DashboardCard>
</template>

<style scoped>
/*
 * 特征详情折叠 —— `grid-template-rows: 0fr ↔ 1fr` 平滑高度过渡。
 *
 * 原理:外层 grid 用 1fr row,内层 `min-height: 0 + overflow: hidden` 跟随 row 高度。
 * 浏览器把 fr 单位作为可插值数值,`transition` 即可奏效。
 * Safari 18+ / Chrome 116+ / Firefox 全系支持 fr 插值。
 */
.feature-collapse {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 280ms cubic-bezier(0.22, 1, 0.36, 1);
}
.feature-collapse.is-collapsed {
  grid-template-rows: 0fr;
}
.feature-collapse-inner {
  min-height: 0;
  overflow: hidden;
}
@media (prefers-reduced-motion: reduce) {
  .feature-collapse {
    transition: none;
  }
}

/*
 * —— 钓鱼野趣 · 水波与鱼竿 ——
 * 大数字如浮漂坐落水面,水波自数字基部缓缓漾开(5.4s 一轮,三环错峰)。
 * 全部走 oklch(from var(--color-accent)) —— 不硬编码颜色,随主题自适应。
 */
.hero-ripple {
  position: absolute;
  left: 1.1rem;
  bottom: 0.35rem;
  width: 0;
  height: 0;
  z-index: 0;
  pointer-events: none;
}
.hero-ripple i {
  position: absolute;
  left: 0;
  top: 0;
  width: 132px;
  height: 132px;
  margin: -66px 0 0 -66px;
  border-radius: 50%;
  border: 1px solid oklch(from var(--color-accent) l c h / 0.45);
  opacity: 0;
  transform: scale(0.35);
}
@media (prefers-reduced-motion: no-preference) {
  .hero-ripple i {
    animation: hero-ripple-out 5.4s cubic-bezier(0.22, 1, 0.36, 1) infinite;
  }
  .hero-ripple i:nth-child(2) {
    animation-delay: 1.8s;
  }
  .hero-ripple i:nth-child(3) {
    animation-delay: 3.6s;
  }
}
@keyframes hero-ripple-out {
  0% {
    opacity: 0;
    transform: scale(0.35);
  }
  18% {
    opacity: 0.5;
  }
  100% {
    opacity: 0;
    transform: scale(1.9);
  }
}

/* 鱼竿图标:idle 时极轻摇曳,hover 时一记「甩竿咬钩」 */
.hero-rod {
  transform-origin: 60% 90%;
}
@media (prefers-reduced-motion: no-preference) {
  .hero-rod {
    animation: hero-rod-sway 4.2s ease-in-out infinite;
  }
  .group:hover .hero-rod {
    animation: hero-rod-cast 640ms cubic-bezier(0.22, 1, 0.36, 1);
  }
}
@keyframes hero-rod-sway {
  0%,
  100% {
    transform: rotate(-2.5deg);
  }
  50% {
    transform: rotate(2.5deg);
  }
}
@keyframes hero-rod-cast {
  0% {
    transform: rotate(0);
  }
  32% {
    transform: rotate(-16deg);
  }
  58% {
    transform: rotate(9deg);
  }
  100% {
    transform: rotate(0);
  }
}
</style>
