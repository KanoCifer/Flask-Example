import { describe, expect, it, vi } from 'vitest';

// 提前 stub @/lib —— useChartColors.ts 顶部 `import { resolveCssColor } from '@/lib'`
// 会把整个 lib 桶拉进来，触发 happy-dom + 缺 @vitejs/plugin-vue 的预存测试基础设施
// 问题（与本测试无关）。withAlpha 本身不依赖 resolveCssColor，
// 这里只关心 withAlpha 的 culori 解析 + 加 alpha 逻辑。
vi.mock('@/lib', () => ({}));

const { withAlpha } = await import('../useChartColors');

describe('withAlpha (culori)', () => {
  it('空字符串输入回退到 safe rgba', () => {
    expect(withAlpha('', 0.18)).toBe('rgba(120, 134, 170, 0.18)');
  });

  it('rgba(...) 输入只改 alpha', () => {
    expect(withAlpha('rgba(255, 0, 0, 1)', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
    expect(withAlpha('rgba(255, 0, 0, 0.8)', 0.2)).toBe('rgba(255, 0, 0, 0.2)');
  });

  it('rgb(...) 转 rgba 并加 alpha', () => {
    expect(withAlpha('rgb(255, 0, 0)', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
    expect(withAlpha('rgb(0, 128, 255)', 0.18)).toBe('rgba(0, 128, 255, 0.18)');
  });

  it('hex 输入解析后转 rgba', () => {
    expect(withAlpha('#5470c6', 0.18)).toBe('rgba(84, 112, 198, 0.18)');
  });

  // 回归测试：这是触发 addColorStop undefined 报错的真实路径。
  // 老 canvas 实现漏判 oklch/hsl 归一化分支，把原字符串透传给 ECharts。
  // culori 原生解析这些色彩空间，直出 rgba，绝不返回原字符串。
  it('oklch / hsl 等现代色彩空间转 rgba，绝不返回原字符串', () => {
    const oklch = withAlpha('oklch(60% 0.2 250)', 0.18);
    expect(oklch).toBe('rgba(0, 129, 241, 0.18)');
    expect(oklch).not.toContain('oklch');

    expect(withAlpha('hsl(0, 100%, 50%)', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
  });

  it('命名色可解析', () => {
    expect(withAlpha('red', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
  });

  it('无法解析的输入回退到 safe rgba，绝不返回原字符串', () => {
    const result = withAlpha('not-a-real-color', 0.3);
    expect(result).toBe('rgba(120, 134, 170, 0.3)');
    expect(result).not.toContain('not-a-real-color');
  });

  it('返回值始终是合法 rgba 字符串（防御性 invariant）', () => {
    const inputs = [
      '',
      'oklch(60% 0.2 250)',
      'hsl(0, 100%, 50%)',
      'invalid-color',
      '#5470c6',
      'rgb(0, 0, 0)',
      'rgba(255, 255, 255, 1)',
      'red',
    ];
    for (const input of inputs) {
      const out = withAlpha(input, 0.5);
      expect(out).toMatch(/^rgba\(/);
      expect(out.endsWith(', 0.5)')).toBe(true);
    }
  });
});
