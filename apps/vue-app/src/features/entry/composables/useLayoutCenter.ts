import { useDebounceFn } from '@vueuse/core';
import { computed, onMounted, onUnmounted, ref, type Ref } from 'vue';

export interface LayoutCenter {
  centerX: Ref<number>;
  centerY: Ref<number>;
  layoutHeight: Ref<number>;
  containerStyle: Ref<{ minHeight: string }>;
}

/**
 * Reactive center point and layout height for card positioning.
 * Observes the parent container's width and window's inner height.
 */
export function useLayoutCenter(
  containerRef: Ref<HTMLElement | null>,
): LayoutCenter {
  const viewportHeight = ref<number>(window.innerHeight);
  const parentWidth = ref<number>(
    typeof window !== 'undefined' ? window.innerWidth : 0,
  );

  const layoutHeight = computed<number>(() =>
    Math.max(viewportHeight.value, 820),
  );

  const centerX = computed<number>(() => parentWidth.value / 2);
  const centerY = computed<number>(() => layoutHeight.value / 2);

  const containerStyle = computed(() => ({
    minHeight: `${layoutHeight.value}px`,
  }));

  const updateDimensions = () => {
    viewportHeight.value = window.innerHeight;
    if (containerRef.value) {
      parentWidth.value = containerRef.value.clientWidth;
    }
  };

  const debouncedUpdate = useDebounceFn(updateDimensions, 100);

  let resizeObserver: ResizeObserver | null = null;

  onMounted(() => {
    updateDimensions();
    if (containerRef.value) {
      resizeObserver = new ResizeObserver(() => {
        debouncedUpdate();
      });
      resizeObserver.observe(containerRef.value);
    }
    window.addEventListener('resize', debouncedUpdate);
  });

  onUnmounted(() => {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    window.removeEventListener('resize', debouncedUpdate);
  });

  return { centerX, centerY, layoutHeight, containerStyle };
}
