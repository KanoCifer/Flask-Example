// OKLCH 数学测试 —— 全部纯函数，无 DOM 依赖。
import { describe, expect, it } from 'vitest';
import {
  buildHarmony,
  contrastRatio,
  formatOklch,
  formatRgb,
  oklchToRgb,
  parseHex,
  parseOklch,
  rgbToHex,
  rgbToOklch,
  relativeLuminance,
} from '../useOklch';

describe('oklchToRgb', () => {
  it('L=1 C=0 → white', () => {
    const { r, g, b, inGamut } = oklchToRgb({ L: 1, C: 0, H: 0 });
    expect({ r, g, b }).toEqual({ r: 255, g: 255, b: 255 });
    expect(inGamut).toBe(true);
  });

  it('L=0 C=0 → black', () => {
    const { r, g, b } = oklchToRgb({ L: 0, C: 0, H: 0 });
    expect({ r, g, b }).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('L=0.5 C=0 → perceptual middle gray (~99 in sRGB)', () => {
    // OKLab 是感知均匀空间，L=0.5 不是 sRGB 的 50% 灰，
    // 而是感知中点，对应 sRGB ~99（参考 oklab.com 交互验证）。
    const { r, g, b } = oklchToRgb({ L: 0.5, C: 0, H: 0 });
    expect(r).toBeGreaterThan(98);
    expect(r).toBeLessThan(101);
    expect(r).toBe(g);
    expect(g).toBe(b);
  });

  it('超出色域时二分降 C 并标 inGamut=false', () => {
    // 0.4 chroma at hue 30 with L=0.65 必然超 sRGB
    const result = oklchToRgb({ L: 0.65, C: 0.4, H: 30 });
    expect(result.inGamut).toBe(false);
    expect(result.usedC).toBeLessThan(0.4);
    // 降 C 后仍在 0..1 linear 区间
    expect(result.r).toBeGreaterThanOrEqual(0);
    expect(result.r).toBeLessThanOrEqual(255);
  });

  it('圆形互转：rgb → oklch → rgb 误差 ≤ 1', () => {
    const original = { r: 100, g: 50, b: 200 };
    const o = rgbToOklch(original);
    const back = oklchToRgb(o);
    expect(Math.abs(back.r - original.r)).toBeLessThanOrEqual(1);
    expect(Math.abs(back.g - original.g)).toBeLessThanOrEqual(1);
    expect(Math.abs(back.b - original.b)).toBeLessThanOrEqual(1);
  });
});

describe('rgbToHex / parseHex', () => {
  it('rgb → hex', () => {
    expect(rgbToHex({ r: 255, g: 0, b: 136 })).toBe('#ff0088');
    expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe('#000000');
  });

  it('hex → rgb 接受 6 位与 3 位', () => {
    expect(parseHex('#ff0088')).toEqual({ r: 255, g: 0, b: 136 });
    expect(parseHex('ff0088')).toEqual({ r: 255, g: 0, b: 136 });
    expect(parseHex('#f08')).toEqual({ r: 255, g: 0, b: 136 });
  });

  it('非法 hex 返回 null', () => {
    expect(parseHex('#xyzxyz')).toBeNull();
    expect(parseHex('#1234')).toBeNull();
    expect(parseHex('')).toBeNull();
  });
});

describe('parseOklch / formatOklch', () => {
  it('标准 oklch() 解析', () => {
    expect(parseOklch('oklch(0.65 0.16 250)')).toEqual({
      L: 0.65,
      C: 0.16,
      H: 250,
    });
  });

  it('带 deg 后缀的 H', () => {
    expect(parseOklch('oklch(0.5 0.1 90deg)')).toEqual({
      L: 0.5,
      C: 0.1,
      H: 90,
    });
  });

  it('空白宽松匹配', () => {
    expect(parseOklch('  oklch(  0.7 0.05 30  )  ')).toEqual({
      L: 0.7,
      C: 0.05,
      H: 30,
    });
  });

  it('非法输入返回 null', () => {
    expect(parseOklch('rgb(0,0,0)')).toBeNull();
    expect(parseOklch('oklch()')).toBeNull();
  });

  it('formatOklch 输出保留 3 位', () => {
    expect(formatOklch({ L: 0.65, C: 0.16, H: 250 })).toBe(
      'oklch(0.65 0.16 250)',
    );
  });

  it('formatRgb 标准化字符串', () => {
    expect(formatRgb({ r: 1, g: 2, b: 3 })).toBe('rgb(1, 2, 3)');
  });
});

describe('contrastRatio (WCAG)', () => {
  it('黑/白 = 21', () => {
    const ratio = contrastRatio(
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
    );
    expect(ratio).toBeCloseTo(21, 1);
  });

  it('相同色 = 1', () => {
    const ratio = contrastRatio(
      { r: 100, g: 100, b: 100 },
      { r: 100, g: 100, b: 100 },
    );
    expect(ratio).toBeCloseTo(1, 5);
  });

  it('对比度对称', () => {
    const a = { r: 200, g: 50, b: 50 };
    const b = { r: 30, g: 80, b: 200 };
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 5);
  });

  it('relativeLuminance 白色 = 1，黑色 = 0', () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5);
  });
});

describe('buildHarmony', () => {
  it('analogous: 3 个色相 ±30', () => {
    const out = buildHarmony({ L: 0.6, C: 0.15, H: 100 }, 'analogous');
    expect(out).toHaveLength(3);
    expect(out[0].oklch.H).toBeCloseTo(70, 5);
    expect(out[1].oklch.H).toBe(100);
    expect(out[2].oklch.H).toBeCloseTo(130, 5);
  });

  it('complementary: 2 个，色相差 180', () => {
    const out = buildHarmony({ L: 0.5, C: 0.2, H: 40 }, 'complementary');
    expect(out).toHaveLength(2);
    expect(out[1].oklch.H).toBeCloseTo(220, 5);
  });

  it('triadic: 3 个，色相差 120/240', () => {
    const out = buildHarmony({ L: 0.5, C: 0.2, H: 0 }, 'triadic');
    expect(out[1].oklch.H).toBeCloseTo(120, 5);
    expect(out[2].oklch.H).toBeCloseTo(240, 5);
  });

  it('splitComplement: 3 个，色相差 150/210', () => {
    const out = buildHarmony({ L: 0.5, C: 0.2, H: 0 }, 'splitComplement');
    expect(out[1].oklch.H).toBeCloseTo(150, 5);
    expect(out[2].oklch.H).toBeCloseTo(210, 5);
  });

  it('tetradic: 4 个，色相差 90/180/270', () => {
    const out = buildHarmony({ L: 0.5, C: 0.2, H: 0 }, 'tetradic');
    expect(out).toHaveLength(4);
    expect(out[1].oklch.H).toBeCloseTo(90, 5);
    expect(out[3].oklch.H).toBeCloseTo(270, 5);
  });

  it('monochromatic: 同 H，按 L 分层', () => {
    const out = buildHarmony({ L: 0.6, C: 0.2, H: 200 }, 'monochromatic');
    expect(out.length).toBeGreaterThanOrEqual(3);
    out.forEach((v) => expect(v.oklch.H).toBe(200));
    // L 应当单调
    for (let i = 1; i < out.length; i += 1) {
      expect(out[i].oklch.L).not.toBe(out[i - 1].oklch.L);
    }
  });

  it('H 越界 360 时正确取模', () => {
    const out = buildHarmony({ L: 0.5, C: 0.1, H: 350 }, 'analogous');
    expect(out[0].oklch.H).toBeCloseTo(320, 5);
    expect(out[2].oklch.H).toBeCloseTo(20, 5);
  });
});
