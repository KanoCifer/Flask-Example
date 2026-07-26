import { resolveCssColor } from '@/lib';
import { computed, onMounted, onUnmounted, ref } from 'vue';

/**
 * 跟踪 :root 上的主题切换（深色模式 + 配色方案），把 CSS token
 * 解析成 ECharts 能吃的 'rgb(...)' 字符串。
 *
 * 为什么不用 useChartColors：那个直接把 oklch raw 值返回给 ECharts，
 * ECharts 颜色流水线不认 oklch。这里走 resolveCssColor → canvas
 * fillStyle 解析成 rgb，并响应 data-color-scheme + class 变化。
 *
 * 具体的主题色取自 design-system 的语义/图表 token，跟着主题一起变。
 * resolveCssColor 已经把 oklch(...) 转成 ECharts 接受的 rgb(...)。
 */
export function useEChartsTheme() {
  const themeVersion = ref(0);
  let observer: MutationObserver | null = null;

  onMounted(() => {
    observer = new MutationObserver(() => {
      themeVersion.value++;
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-color-scheme'],
    });
  });

  onUnmounted(() => observer?.disconnect());

  // 显式 touch themeVersion 让 computed 跟随主题切换重算
  const subtextColor = computed(() => {
    void themeVersion.value;
    return resolveCssColor('--muted');
  });
  const axisColor = computed(() => {
    void themeVersion.value;
    return resolveCssColor('--border');
  });
  const splitLineColor = computed(() => {
    void themeVersion.value;
    return resolveCssColor('--muted');
  });
  const primaryColor = computed(() => {
    void themeVersion.value;
    return resolveCssColor('--accent');
  });
  const mutedFillColor = computed(() => {
    void themeVersion.value;
    return resolveCssColor('--muted');
  });

  return {
    subtextColor,
    axisColor,
    splitLineColor,
    primaryColor,
    mutedFillColor,
  };
}
