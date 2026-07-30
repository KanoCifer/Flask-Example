<script setup lang="ts">
/**
 * FishingConditionsPanel —— 地图右上浮动条件卡（任务 284）。
 *
 * 数据驱动: 从 useFishingMapStore 取 liveWeather / locationName / indexData /
 * tideData —— 全部 store 已拉好的字段;父组件只需传 store 引用。
 *
 * 整卡可点击 → 跳 /fishing-map/weather?lng=...&lat=...(与 WeatherView 一致)。
 * 桌面浮动右上(absolute top-4 right-4 z-60);窄屏 <820px 隐藏。
 *
 * 视觉: 沿用 DashboardCard 风格的紧凑面板,主题 token 全覆盖。
 */
import {
  DEFAULT_MAP_CENTER,
  useFishingMapStore,
} from '@/features/fishing/stores/fishingMap';
import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { ChevronRight, Droplets, Moon, Thermometer, Wind } from '@lucide/vue';
import type { WeatherDay, WeatherHourly } from '@readinglist/types';

const emit = defineEmits<{
  /** 跳 /fishing-map/weather 之前父组件可拦截(用于切到 weather 后 reset) */
  navigate: [];
}>();

const router = useRouter();
const fishingMapStore = useFishingMapStore();
const { liveWeather, locationName, indexData, weatherHourly, tideData } =
  storeToRefs(fishingMapStore);

/** 当前坐标:store 没有专门字段,fallback 默认中心;activeLocation 由父级用 useFishingDashboard 注入 */
const props = withDefaults(
  defineProps<{
    location?: [number, number] | null;
  }>(),
  { location: null },
);

/**
 * 渔情窗口:从 indexData.level 直接展示 + 数字提示。
 * 风暴 / 极好 / 一般这种 level 字符串直接由后端 FishingIndexLevel 给出。
 */
const fishingLevel = computed(() => indexData.value?.level ?? '—');
const fishingIndexValue = computed(() =>
  typeof indexData.value?.fishing_index === 'number'
    ? indexData.value.fishing_index.toFixed(0)
    : '—',
);

/** 当前温度 —— QWeather 返回字符串 */
const tempText = computed(() => {
  const t = liveWeather.value?.temp;
  if (!t) return '—';
  const n = Number(t);
  return Number.isFinite(n) ? `${n}°` : `${t}°`;
});

/** 风速 + 风向 —— 简洁展示 */
const windText = computed(() => {
  const w = liveWeather.value;
  if (!w) return '—';
  return `${w.windDir ?? ''} ${w.windScale ?? ''}级`.trim() || '—';
});

/** 当前小时水温近似值 —— WeatherHourly 暂无专用字段,用温度代理;若无 hourly 则取当前 temp */
const waterTempText = computed(() => tempText.value);

/** 今日月相 —— 取 forecasts[0].moonPhase;无则兜底 */
const moonPhaseText = computed(() => {
  const daily = (indexData.value?.forecasts ?? []) as WeatherDay[];
  return daily[0]?.moonPhase ?? '';
});

/** 潮汐摘要 —— 若 store 拉到了 tide_data,展示一条「涨潮 / 退潮」;否则 '—' */
const tideSummary = computed(() => {
  if (!tideData.value?.tideTable?.length) return '';
  const next = tideData.value.tideTable[0];
  return `${next.type === 'H' ? '高潮' : '低潮'} ${next.fxTime.slice(11, 16)}`;
});

/** 最近一次 hourly 取一条 —— 仅用于让 conditions panel 显示有数据感 */
const lastHourly = computed<WeatherHourly | null>(() => {
  return weatherHourly.value?.[0] ?? null;
});

const locationLabel = computed(() => locationName.value || '当前位置');

/** 跳 weather 页:带 lng / lat;无 location 时用默认中心 */
function openWeather(): void {
  const loc = props.location ?? DEFAULT_MAP_CENTER;
  void router.push({
    path: '/fishing-map/weather',
    query: { lng: String(loc[0]), lat: String(loc[1]) },
  });
  emit('navigate');
}
</script>

<template>
  <button
    type="button"
    class="conditions-panel bg-surface text-ink group absolute top-20 right-4 z-60 hidden w-64 flex-col gap-3 rounded-2xl border px-4 py-3 text-left md:flex"
    :aria-label="`查看完整天气与渔情 · ${locationLabel}`"
    @click="openWeather"
  >
    <!-- Header -->
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <p
          class="text-ink font-family-averia text-sm leading-tight font-semibold"
        >
          当前条件
        </p>
        <p class="text-muted mt-0.5 truncate text-xs">
          {{ locationLabel }}
        </p>
      </div>
      <ChevronRight
        class="text-muted group-hover:text-ink mt-0.5 h-4 w-4 shrink-0 transition-colors"
        aria-hidden="true"
      />
    </div>

    <!-- 渔情窗口 -->
    <div
      class="bg-page flex items-baseline justify-between gap-2 rounded-xl px-3 py-2"
    >
      <span class="text-muted text-xs">渔情</span>
      <span class="flex items-baseline gap-1.5">
        <span class="text-ink font-serif text-lg leading-none font-semibold">
          {{ fishingIndexValue }}
        </span>
        <span class="text-muted text-xs">{{ fishingLevel }}</span>
      </span>
    </div>

    <!-- 指标行 -->
    <ul class="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
      <li class="flex items-center gap-1.5">
        <Thermometer
          class="text-muted h-3.5 w-3.5 shrink-0"
          aria-hidden="true"
        />
        <span class="text-muted">气温</span>
        <span class="text-ink ml-auto tabular-nums">{{ tempText }}</span>
      </li>
      <li class="flex items-center gap-1.5">
        <Wind class="text-muted h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span class="text-muted">风</span>
        <span class="text-ink ml-auto truncate tabular-nums">{{
          windText
        }}</span>
      </li>
      <li class="flex items-center gap-1.5">
        <Droplets class="text-muted h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span class="text-muted">水温</span>
        <span class="text-ink ml-auto tabular-nums">{{ waterTempText }}</span>
      </li>
      <li class="flex items-center gap-1.5">
        <Moon class="text-muted h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span class="text-muted">月相</span>
        <span class="text-ink ml-auto truncate tabular-nums">{{
          moonPhaseText || '—'
        }}</span>
      </li>
    </ul>

    <!-- 潮汐行(可选) -->
    <p
      v-if="tideSummary"
      class="text-muted border-border border-t pt-2 text-xs"
    >
      <span class="text-muted/80">下次潮汐 ·</span>
      <span class="text-ink ml-1">{{ tideSummary }}</span>
    </p>

    <!-- 占位:store 未就绪时给一句提示,避免空白按钮显得空荡 -->
    <p
      v-if="!liveWeather && !lastHourly"
      class="text-muted text-xs leading-tight"
    >
      定位后将展示实时天气与渔情窗口
    </p>
  </button>
</template>
