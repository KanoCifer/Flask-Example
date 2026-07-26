// 读取某个 scheme 的所有 token 计算值。
//
// 做法：在 document.body 上挂一个临时 [data-color-scheme] 节点，
// 通过 getComputedStyle 读到所有 token 的解析色（CSS 把 oklch 标准化后
// 通常返回 rgb()/color(srgb ...)，少数浏览器保留 oklch 字面量——我们统一
// 用 raw 字符串展示，复制到剪贴板仍可被 Figma 等消费）。
import { onScopeDispose, ref, watchEffect, type Ref } from 'vue';
import type { ColorScheme } from '@/stores';
import { COLOR_SCHEMES } from '@/stores';
import { TOKEN_META } from '../lib/schemeMeta';

export interface ResolvedTokens {
  [tokenName: string]: string;
}

/**
 * 给一个 scheme，返回其 token 计算值的响应式引用。
 * 在 setup() 内调用；组件卸载时自动清理探测节点。
 */
export function useSchemeTokens(scheme: Ref<ColorScheme>): Ref<ResolvedTokens> {
  const tokens = ref<ResolvedTokens>({});
  let probe: HTMLDivElement | null = null;

  const ensureProbe = () => {
    if (probe || typeof document === 'undefined') return;
    probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    // 离屏但保留 layout，让 oklch 等相对色被解析
    probe.style.position = 'absolute';
    probe.style.left = '-9999px';
    probe.style.top = '0';
    probe.style.width = '1px';
    probe.style.height = '1px';
    probe.style.pointerEvents = 'none';
    document.body.appendChild(probe);
  };

  const sample = () => {
    ensureProbe();
    if (!probe) return;
    probe.setAttribute('data-color-scheme', scheme.value);
    const cs = window.getComputedStyle(probe);
    const next: ResolvedTokens = {};
    for (const t of TOKEN_META) {
      next[t.name] = cs.getPropertyValue(`--${t.name}`).trim();
    }
    tokens.value = next;
  };

  watchEffect(() => {
    // 依赖收集：scheme 变了就重新采样
    void scheme.value;
    sample();
  });

  onScopeDispose(() => {
    probe?.remove();
    probe = null;
  });

  return tokens;
}

/** 列出全部可用 scheme（代理自 @/stores 以保持单一来源） */
export function listSchemes(): readonly ColorScheme[] {
  return COLOR_SCHEMES;
}
