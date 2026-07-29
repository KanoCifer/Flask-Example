<template>
  <div>
    <v-chart
      v-if="!loading && tideData"
      :option="tideOptions"
      style="width: 100%; height: 300px"
      autoresize
    />
    <div v-else class="flex h-64 items-center justify-center">
      <span class="text-muted">正在加载潮汐数据...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { weatherGateway } from '@readinglist/api';
import { useNotificationStore } from '@/stores';
import dayjs from 'dayjs';
import { computed, onMounted, ref, watch } from 'vue';
import VChart from 'vue-echarts';

interface TideData {
  updateTime: string;
  tideTable: { fxTime: string; height: number | string; type: 'H' | 'L' }[];
  tideHourly: { fxTime: string; height: number | string }[];
}

const props = withDefaults(
  defineProps<{
    harbor?: string;
    date?: string;
  }>(),
  {
    harbor: 'P2352',
    date: dayjs().format('YYYYMMDD'),
  },
);

const notifier = useNotificationStore();
const tideData = ref<TideData | null>(null);
const loading = ref<boolean>(false);
const isDarkMode = ref<boolean>(false);

// 检测深色模式
const checkDarkMode = () => {
  isDarkMode.value = window.matchMedia('(prefers-color-scheme: dark)').matches;
};

// 从后端获取潮汐数据
const fetchTideData = async (harbor: string, date: string) => {
  loading.value = true;
  try {
    const res = await weatherGateway.getTide({ harbor, date });
    if (res.data.tideHourly && res.data.tideHourly.length > 0) {
      tideData.value = {
        updateTime: res.data.updateTime,
        tideTable: res.data.tideTable,
        tideHourly: res.data.tideHourly,
      };
    }
  } catch {
    notifier.error('获取潮汐信息失败，请稍后再试');
  } finally {
    loading.value = false;
  }
};

const tideOptions = computed(() => {
  if (!tideData.value) return {};

  const textColor = isDarkMode.value ? '#e5e7eb' : '#333';
  const subTextColor = isDarkMode.value ? '#9ca3af' : '#666';
  const lineColor = '#0ea5e9';
  const todayStr = dayjs().format('YYYY-MM-DD');

  // 获取当前时间索引
  const now = dayjs();
  let currentTimeIndex = -1;
  tideData.value.tideHourly.forEach((point, index) => {
    const pointTime = dayjs(point.fxTime);
    if (pointTime.isBefore(now) || pointTime.isSame(now)) {
      currentTimeIndex = index;
    }
  });

  return {
    title: {
      text: `今日潮汐变化（黄埔港）${todayStr}`,
      left: 'center',
      textStyle: {
        color: textColor,
        fontSize: 16,
        fontWeight: 'bold',
      },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDarkMode.value
        ? 'rgba(30, 41, 59, 0.9)'
        : 'rgba(255, 255, 255, 0.95)',
      borderColor: isDarkMode.value ? '#475569' : '#e5e7eb',
      textStyle: {
        color: textColor,
      },
      formatter: (params: unknown[]) => {
        const param = params[0] as { axisValue: string; data: number };
        const timeStr = dayjs(param.axisValue).format('HH:mm');
        return `<div style="padding: 2px 0;">
          <div style="font-weight: bold; margin-bottom: 4px;">${timeStr}</div>
          <div>潮高: <span style="color: ${lineColor}; font-weight: bold;">${param.data.toFixed(2)} m</span></div>
        </div>`;
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: tideData.value.tideHourly.map((point) => point.fxTime),
      axisLabel: {
        formatter: (value: string) => {
          return dayjs(value).format('HH:00');
        },
        color: subTextColor,
        interval: Math.floor(tideData.value.tideHourly.length / 6),
      },
      axisLine: {
        lineStyle: {
          color: subTextColor,
        },
      },
      splitLine: {
        show: false,
      },
    },
    yAxis: {
      type: 'value',
      name: '潮高 (m)',
      nameTextStyle: {
        color: subTextColor,
        fontSize: 12,
      },
      axisLabel: {
        color: subTextColor,
      },
      axisLine: {
        lineStyle: {
          color: subTextColor,
        },
      },
      splitLine: {
        lineStyle: {
          color: isDarkMode.value ? '#334155' : '#f3f4f6',
        },
      },
    },
    series: [
      // 潮汐曲线
      {
        name: '潮高',
        data: tideData.value.tideHourly.map((point) => Number(point.height)),
        type: 'line',
        smooth: true,
        lineStyle: {
          color: lineColor,
          width: 3,
        },
        itemStyle: {
          color: lineColor,
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(14, 165, 233, 0.3)' },
              { offset: 1, color: 'rgba(14, 165, 233, 0.05)' },
            ],
          },
        },
        markLine:
          currentTimeIndex >= 0
            ? {
                symbol: ['none', 'none'],
                lineStyle: {
                  color: '#f59e0b',
                  type: 'dashed',
                  width: 2,
                },
                label: {
                  show: true,
                  position: 'end',
                  formatter: '现在',
                  color: '#f59e0b',
                  fontWeight: 'bold',
                },
                data: [
                  {
                    xAxis: currentTimeIndex,
                  },
                ],
              }
            : undefined,
        markPoint: {
          symbol: 'none',
          label: {
            show: true,
            position: 'top',
            color: textColor,
            fontSize: 11,
            fontWeight: 'bold',
            backgroundColor: isDarkMode.value
              ? 'rgba(30, 41, 59, 0.9)'
              : 'rgba(255, 255, 255, 0.95)',
            padding: [4, 8],
            borderRadius: 4,
            borderColor: isDarkMode.value ? '#475569' : '#e5e7eb',
            borderWidth: 1,
          },
          data: tideData.value.tideTable.map((t) => {
            const index = tideData.value!.tideHourly.findIndex(
              (h) =>
                dayjs(h.fxTime).isAfter(dayjs(t.fxTime)) ||
                dayjs(h.fxTime).isSame(dayjs(t.fxTime)),
            );
            const timeStr = dayjs(t.fxTime).format('HH:mm');
            const heightNum = Number(t.height);
            return {
              name: t.type === 'H' ? '高潮' : '低潮',
              coord: [index >= 0 ? index : 0, heightNum],
              value: `${t.type === 'H' ? '🌊' : '📉'} ${timeStr}\n${heightNum.toFixed(2)}m`,
            };
          }),
        },
      },
    ],
  };
});

// harbor 或 date 变化时自动刷新
watch(
  () => [props.harbor, props.date],
  ([harbor, date]) => {
    void fetchTideData(harbor, date);
  },
  { immediate: true },
);

onMounted(() => {
  checkDarkMode();
  // 监听深色模式变化
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', checkDarkMode);
});
</script>
