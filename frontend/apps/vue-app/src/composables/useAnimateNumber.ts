import { onUnmounted, ref } from 'vue';

export function useAnimateNumber(duration = 800) {
  const displayValue = ref(0);
  let rafId: number | null = null;
  let startTime: number | null = null;
  let targetValue = 0;

  function tick(now: number) {
    if (startTime === null) startTime = now;

    // Pause animation when tab is hidden
    if (document.hidden) {
      rafId = requestAnimationFrame(tick);
      return;
    }

    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);

    displayValue.value = Math.floor(progress * targetValue);

    if (progress < 1) {
      rafId = requestAnimationFrame(tick);
    } else {
      displayValue.value = targetValue;
      rafId = null;
    }
  }

  const animateTo = (target: number) => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    targetValue = target;
    startTime = null;
    rafId = requestAnimationFrame(tick);
  };

  onUnmounted(() => {
    if (rafId !== null) cancelAnimationFrame(rafId);
  });

  return { displayValue, animateTo };
}
