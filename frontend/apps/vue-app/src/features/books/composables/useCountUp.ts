/**
 * useCountUp — 数字 tween 动画 (0 → target)
 *
 * 用 `@vueuse/core` 的 `useTransition` 包装一层,接受一个 ref<number>
 * 源,产出一个 ref<number> 当前值。模板里直接显示即可,无需 watch。
 *
 * 设计要点:
 * - duration 默认 900ms,符合 "一秒内涨到位" 的视觉节奏
 * - ease 用 easeOutCubic:启步快、收尾柔,数字看起来被"推"上去
 * - 源 ref 突变时(usePeriodNavigation 切模式 / 重新拉数据),tween 自然衔接
 * - 源 < 0 或 null 时不会崩(useTransition 容忍),展示侧 formatDuration 兜底
 *
 * @example
 *   const totalReadTimeAnim = useCountUp(
 *     computed(() => activeSnapshot.value?.totalReadTime ?? 0),
 *   );
 *   <p>{{ formatDuration(totalReadTimeAnim) }}</p>
 */

import { useTransition, TransitionPresets } from '@vueuse/core';
import type { ComputedRef, Ref } from 'vue';

export interface UseCountUpOptions {
  /** 动画时长(ms);默认 900 */
  duration?: number;
}

export function useCountUp(
  source: Ref<number>,
  options?: UseCountUpOptions,
): ComputedRef<number> {
  const { duration = 900 } = options ?? {};
  // 显式泛型 <number>:让 vueuse 14 的 useTransition 命中第三个 overload
  // (MaybeRefOrGetter<T> → ComputedRef<T>)而不是 array/tuple overload。
  // easing 字段接受 CubicBezierPoints,easeOutCubic = [0.33, 1, 0.68, 1]。
  return useTransition<number>(source, {
    duration,
    easing: TransitionPresets.easeOutCubic,
  });
}
