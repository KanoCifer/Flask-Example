import { ref, watch, onUnmounted } from 'vue';

const SHIMMER_TIPS = ['分析文章结构…', '提取关键信息…', '生成总结内容…'];

/**
 * 轮播一组提示文案，loading 时启动、停止时清理。
 * 配合 AnimatePresence 显示当前第一条。
 */
export function useShimmerTips(intervalMs = 2000) {
  const tips = ref<string[]>([...SHIMMER_TIPS]);
  const active = ref(false);
  let timer: ReturnType<typeof setInterval> | null = null;

  watch(active, (on) => {
    if (on) {
      timer = setInterval(() => {
        const first = tips.value.shift();
        if (first) tips.value.push(first);
      }, intervalMs);
    } else if (timer) {
      clearInterval(timer);
      timer = null;
    }
  });

  onUnmounted(() => {
    if (timer) clearInterval(timer);
  });

  return { tips, active };
}
