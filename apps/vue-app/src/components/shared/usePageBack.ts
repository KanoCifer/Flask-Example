import { useRouter } from 'vue-router';

/**
 * 智能返回:有 history 走 back,否则 push 到 fallback。
 *
 * 用途:PageHero 等需要"返回上一页"的组件。
 * SSR 安全:仅在浏览器内检查 window.history。
 */
export function usePageBack() {
  const router = useRouter();

  function back(fallback = '/'): void {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  }

  return { back };
}
