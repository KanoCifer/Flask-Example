<script setup lang="ts">
/* eslint-disable vue/no-v-text-v-html-on-component -- renderedSummary is sanitized via renderMarkdown; motion.div renders a plain div */
/**
 * AI 天气分析 - 抽屉内嵌扁平组件
 *
 * 由 AnalysisDrawer 承载主标题与关闭按钮,本组件只负责:
 * - 顶部工具条: 状态徽章 + 模型选择 + 生成/取消按钮
 * - 中部结果区: 加载态 / 摘要 / 占位 / 无数据
 * - 底部脚注: 数据更新时间
 *
 * 设计原则:
 * - 扁平化嵌入,不再包裹 squircle 外壳(避免与 drawer header 形成两层)
 * - 不重复标题(drawer header 已是「智能分析」)
 * - 严格使用 semantic token,无装饰性光晕
 */
import { useNotificationStore } from '@/stores';
import { formatDate } from '@/lib/dayjs';
import { aiGateway } from '@/features/ai';
import { HoverDropdown, Button as UiButton } from '@/components';
import { renderMarkdown } from '@/composables';
import { Check, ChevronDown } from '@lucide/vue';
import dayjs from 'dayjs';
import { AnimatePresence, motion } from 'motion-v';
import { computed, onUnmounted, ref, watch } from 'vue';

interface LiveWeather {
  obsTime: string;
  temp: string;
  text: string;
  windDir: string;
  windScale: string;
  humidity: string;
  icon: string;
}

interface ForecastDay {
  fxDate: string;
  tempMax: string;
  tempMin: string;
  textDay: string;
  iconDay: string;
}

interface TideData {
  updateTime: string;
  tideTable: { fxTime: string; height: number | string; type: 'H' | 'L' }[];
  tideHourly: { fxTime: string; height: number | string }[];
}

interface FishingIndexData {
  fishing_index: number;
  expert_score: number;
  residual: number;
  level: string;
  feature_breakdown: Record<string, number>;
}

interface WeatherAnalysisPayload {
  liveWeather?: LiveWeather | null;
  forecasts?: ForecastDay[];
  tideData?: TideData | null;
  weatherIndices?: Array<Record<string, unknown>>;
  fishingIndex?: FishingIndexData;
  locationName?: string;
  tideSpotName?: string;
}

const AI_MODELS = [
  { id: 'Ling-2.6-1T', name: 'Ling 2.6' },
  { id: 'Ling-2.6-flash', name: 'Ling 2.6 Flash' },
  { id: 'Ring-2.5-1T', name: 'Ring 2.5' },
  { id: 'Ling-3.0-flash', name: 'Ling 3.0 Flash' },
];

const textShimmer = ref<string[]>([
  '正在整理天气变化...',
  '正在评估体感与风况...',
  '正在结合潮汐节奏...',
]);

const selectedModel = ref(AI_MODELS[0].id);

const selectedModelName = computed(() => {
  const m = AI_MODELS.find((m) => m.id === selectedModel.value);
  return m?.name ?? '选择模型';
});

/** 选完即关 — slot 暴露的 close() 在 picker 类场景下比 150ms grace 更合适 */
function pickModel(id: string, close: () => void) {
  selectedModel.value = id;
  close();
}

let shimmerTimer: ReturnType<typeof setInterval> | null = null;
let abortController: AbortController | null = null;

const props = withDefaults(
  defineProps<{
    weather_data?: WeatherAnalysisPayload | null;
    autoAnalyze?: boolean;
  }>(),
  {
    weather_data: null,
    autoAnalyze: false,
  },
);

const notifier = useNotificationStore();
const loading = ref(false);
const summary = ref('');
const reasoning = ref('');
const hasGenerated = ref(false);
const errorMessage = ref('');

// 推理区折叠状态：true=展开 / false=收起 / null=跟随自动态（summary 为空时展开）
const reasoningOverride = ref<boolean | null>(null);
const isReasoningOpen = computed(() => {
  if (reasoningOverride.value !== null) return reasoningOverride.value;
  return !summary.value;
});
function toggleReasoning() {
  reasoningOverride.value = !isReasoningOpen.value;
}

const renderedSummary = computed(() => {
  if (!summary.value) return '';
  try {
    return renderMarkdown(summary.value);
  } catch {
    return summary.value;
  }
});
const lastAutoFingerprint = ref<string>('');

const normalizedData = computed<WeatherAnalysisPayload | null>(() => {
  if (!props.weather_data || typeof props.weather_data !== 'object')
    return null;
  return props.weather_data;
});

const hasInputData = computed(() => {
  const data = normalizedData.value;
  if (!data) return false;
  return Boolean(
    data.liveWeather ||
    (data.forecasts && data.forecasts.length > 0) ||
    data.tideData,
  );
});

const payload = computed(() => {
  const data = normalizedData.value;
  if (!data) return null;
  return {
    liveWeather: data.liveWeather ?? null,
    forecasts: data.forecasts ?? [],
    tideData: data.tideData ?? null,
    weatherIndices: data.weatherIndices ?? [],
    fishingIndex: data.fishingIndex ?? undefined,
    locationName: data.locationName ?? '钓鱼地点',
    tideSpotName: data.tideSpotName ?? '潮汐点位',
    generatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  };
});

const canGenerate = computed(() => hasInputData.value && !loading.value);

const statusLabel = computed(() => {
  if (loading.value) return '分析中';
  if (errorMessage.value) return '分析失败';
  if (hasGenerated.value) return '已生成';
  return '待生成';
});

const statusClass = computed(() => {
  if (loading.value) return 'bg-accent/15 text-ink';
  if (errorMessage.value) return 'bg-destructive/15 text-destructive';
  if (hasGenerated.value) return 'bg-success/15 text-success';
  return 'bg-surface text-muted';
});

const resetState = () => {
  summary.value = '';
  reasoning.value = '';
  reasoningOverride.value = null;
  hasGenerated.value = false;
  errorMessage.value = '';
};

const fetchWeatherAnalysis = () => {
  if (!payload.value) {
    errorMessage.value = '缺少天气数据，无法分析';
    return;
  }
  void _doFetch();
};

const _doFetch = async () => {
  if (abortController) abortController.abort();

  abortController = new AbortController();
  loading.value = true;
  errorMessage.value = '';
  summary.value = '';
  reasoning.value = '';
  reasoningOverride.value = null;
  hasGenerated.value = false;

  try {
    await aiGateway.weatherAnalysis(
      {
        weather_data: payload.value,
        model_id: selectedModel.value,
      },
      {
        onData: (data) => {
          if (!data.content) return;
          // type 缺省按 content 处理；reasoning 流到独立 ref，
          // 正文流到 summary。二者互不影响渲染。
          if (data.type === 'reasoning') {
            reasoning.value += data.content;
          } else {
            summary.value += data.content;
          }
          if (data.is_end) hasGenerated.value = true;
        },
        onDone: () => {
          hasGenerated.value = true;
        },
      },
      abortController.signal,
    );
    if (summary.value && !hasGenerated.value) hasGenerated.value = true;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') return;
    errorMessage.value =
      error instanceof Error ? error.message : 'AI 分析失败，请稍后重试';
    notifier.error(errorMessage.value);
  } finally {
    loading.value = false;
  }
};

const cancelAnalysis = () => {
  abortController?.abort();
};

watch(
  () => props.weather_data,
  () => {
    resetState();
  },
);

watch(
  () => loading.value,
  (isLoading) => {
    if (isLoading) {
      shimmerTimer = setInterval(() => {
        const first = textShimmer.value.shift();
        if (first) textShimmer.value.push(first);
      }, 1800);
    } else if (shimmerTimer) {
      clearInterval(shimmerTimer);
      shimmerTimer = null;
    }
  },
);

watch(
  [() => props.autoAnalyze, () => payload.value],
  ([autoAnalyze, currentPayload]) => {
    if (!autoAnalyze || !currentPayload || loading.value) return;
    const fingerprint = JSON.stringify(currentPayload);
    if (fingerprint === lastAutoFingerprint.value) return;
    lastAutoFingerprint.value = fingerprint;
    fetchWeatherAnalysis();
  },
  { deep: true },
);

onUnmounted(() => {
  if (abortController) abortController.abort();
  if (shimmerTimer) clearInterval(shimmerTimer);
});
</script>

<template>
  <div class="flex h-full flex-col gap-4">
    <!-- 工具条: 状态徽章 + 模型选择 + 主操作 -->
    <div class="flex items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-2">
        <span
          class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
          :class="statusClass"
        >
          {{ statusLabel }}
        </span>
        <HoverDropdown
          v-if="!loading"
          panel-class="bg-page absolute top-full left-0 z-50 mt-2 w-40 rounded-2xl p-1.5 ring-1 ring-black/5 backdrop-blur-xs dark:ring-white/10"
        >
          <template #trigger="{ isOpen }">
            <button
              type="button"
              aria-label="选择模型"
              :aria-expanded="isOpen || undefined"
              aria-haspopup="true"
              class="bg-surface text-ink hover:ring-accent focus:ring-accent flex min-w-0 cursor-pointer items-center gap-1 truncate rounded-lg border px-2 py-1 text-xs transition-shadow focus:ring-1 focus:outline-none"
            >
              <span class="truncate">{{ selectedModelName }}</span>
              <ChevronDown
                :size="12"
                class="shrink-0 transition-transform duration-150"
                :class="{ 'rotate-180': isOpen }"
              />
            </button>
          </template>
          <template #default="{ close }">
            <button
              v-for="model in AI_MODELS"
              :key="model.id"
              type="button"
              @click="pickModel(model.id, close)"
              class="hover:bg-surface text-ink flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs"
            >
              <span>{{ model.name }}</span>
              <Check
                v-if="model.id === selectedModel"
                :size="14"
                class="text-accent"
              />
            </button>
          </template>
        </HoverDropdown>
      </div>

      <UiButton
        v-if="loading"
        size="sm"
        variant="ghost"
        class="bg-destructive text-ink hover:bg-destructive/90 inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition"
        @click="cancelAnalysis"
      >
        <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" />
        </svg>
        取消分析
      </UiButton>
      <UiButton
        v-else
        size="sm"
        :disabled="!canGenerate"
        @click="fetchWeatherAnalysis"
      >
        {{ hasGenerated ? '重新分析' : '生成分析' }}
      </UiButton>
    </div>

    <!-- 无数据空态 -->
    <div
      v-if="!hasInputData"
      class="flex flex-1 flex-col items-center justify-center text-center"
    >
      <div
        class="bg-surface mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="text-muted h-7 w-7"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
          />
        </svg>
      </div>
      <p class="text-muted text-sm">等待天气与潮汐数据加载</p>
      <p class="text-muted mt-1 text-xs">数据到位后即可生成分析</p>
    </div>

    <!-- 有数据: 结果区 + 脚注 -->
    <div v-else class="flex min-h-0 flex-1 flex-col gap-3">
      <div class="bg-surface/40 flex-1 overflow-auto rounded-xl p-4">
        <div class="text-muted mb-3 flex items-center gap-2 text-xs">
          <span
            class="bg-surface/40 h-1.5 w-1.5 rounded-full"
            aria-hidden="true"
          ></span>
          AI 分析输出
        </div>

        <!-- 思考过程（仅 reasoning 非空时显示） -->
        <div
          v-if="reasoning"
          class="mb-3 border-b border-ink/10 pb-3"
        >
          <button
            type="button"
            class="text-muted hover:text-ink inline-flex cursor-pointer items-center gap-1 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 focus:outline-none"
            :aria-expanded="isReasoningOpen"
            @click="toggleReasoning"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3 w-3 shrink-0 transition-transform duration-200 motion-reduce:transition-none"
              :class="isReasoningOpen && 'rotate-90'"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 6l6 6-6 6"
              />
            </svg>
            <span>思考过程</span>
          </button>
          <div
            v-if="isReasoningOpen"
            class="text-muted mt-1.5 whitespace-pre-wrap text-xs leading-relaxed"
          >
            {{ reasoning }}
          </div>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            v-if="loading"
            key="loading"
            :initial="{ opacity: 0, y: 8 }"
            :animate="{ opacity: 1, y: 0 }"
            :exit="{ opacity: 0, y: -8 }"
            class="text-muted text-sm"
          >
            <p>{{ textShimmer[0] }}</p>
            <div class="mt-3 space-y-2">
              <div class="bg-surface h-3 w-full animate-pulse rounded"></div>
              <div class="bg-surface h-3 w-5/6 animate-pulse rounded"></div>
              <div class="bg-surface h-3 w-2/3 animate-pulse rounded"></div>
            </div>
          </motion.div>
          <motion.div
            v-else-if="summary"
            key="summary"
            :initial="{ opacity: 0, y: 8 }"
            :animate="{ opacity: 1, y: 0 }"
            :exit="{ opacity: 0, y: -8 }"
            class="prose prose-sm text-ink max-w-none"
            v-html="renderedSummary"
          ></motion.div>
          <motion.div
            v-else
            key="placeholder"
            :initial="{ opacity: 0, y: 8 }"
            :animate="{ opacity: 1, y: 0 }"
            :exit="{ opacity: 0, y: -8 }"
            class="text-muted text-sm"
          >
            点击「生成分析」，获取适合外出与钓鱼的天气建议。
          </motion.div>
        </AnimatePresence>
      </div>

      <div
        v-if="errorMessage"
        class="bg-destructive/10 text-destructive rounded-lg p-3 text-sm"
        role="alert"
      >
        {{ errorMessage }}
      </div>

      <div class="text-muted text-xs leading-relaxed">
        天气更新: {{ formatDate(normalizedData?.liveWeather?.obsTime) ?? '--'
        }}<br />
        潮汐更新: {{ formatDate(normalizedData?.tideData?.updateTime) ?? '--' }}
      </div>
    </div>
  </div>
</template>
