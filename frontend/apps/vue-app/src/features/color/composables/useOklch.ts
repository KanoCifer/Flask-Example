// OKLCH ↔ sRGB 转换 + 工具函数集。
//
// 全部是纯函数；可独立单测，不依赖 Vue。
// 颜色数学遵循 W3C css-color-4 与 https://bottosson.github.io/posts/oklab/ 推导。
// 超出 sRGB 色域时通过二分搜索降 chroma，找到最大可显示饱和度。
import { computed, ref, type Ref } from 'vue';

// ---------- 类型 ----------

/** 三个 OKLCH 分量；L ∈ [0, 1]、C ≥ 0、H ∈ [0, 360) */
export interface Oklch {
  L: number;
  C: number;
  H: number;
}

/** 0–255 sRGB 整数色 */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** 转换结果附带色域状态：若原始 C 超出色域会被裁剪 */
export interface RgbResult extends Rgb {
  /** 原始 L/C/H 是否已在 sRGB 色域内 */
  inGamut: boolean;
  /** 实际用于显示的 chroma（若被裁剪则 < 输入 C） */
  usedC: number;
}

// ---------- 内部辅助 ----------

const cbrt = (v: number) => (v < 0 ? -Math.pow(-v, 1 / 3) : Math.pow(v, 1 / 3));

/** 0–255 sRGB → 0–1 线性 sRGB（gamma 反向） */
function srgbToLinear(v: number): number {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** 0–1 线性 sRGB → 0–1 显示 sRGB（gamma 正向） */
function linearToSrgb(v: number): number {
  const c = Math.max(0, Math.min(1, v));
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

// ---------- OKLCH → linear sRGB ----------

/** OKLCH → 线性 sRGB（不裁剪，r/g/b 可能为负或 > 1） */
export function oklchToLinearRgb({ L, C, H }: Oklch): {
  r: number;
  g: number;
  b: number;
} {
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  // OKLab 锥体 LMS
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  // LMS^3 → linear sRGB
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
}

function isInLinearGamut({
  r,
  g,
  b,
}: {
  r: number;
  g: number;
  b: number;
}): boolean {
  // 严格 ±1e-4 容忍度，避免边界值来回抖
  return (
    r >= -1e-4 &&
    r <= 1 + 1e-4 &&
    g >= -1e-4 &&
    g <= 1 + 1e-4 &&
    b >= -1e-4 &&
    b <= 1 + 1e-4
  );
}

// ---------- OKLCH → 显示 sRGB（带色域裁剪） ----------

/** OKLCH → 0–255 sRGB；超出色域时二分降低 C 直至可显示。 */
export function oklchToRgb(oklch: Oklch): RgbResult {
  const probe = oklchToLinearRgb(oklch);
  if (isInLinearGamut(probe)) {
    return {
      r: Math.round(linearToSrgb(probe.r) * 255),
      g: Math.round(linearToSrgb(probe.g) * 255),
      b: Math.round(linearToSrgb(probe.b) * 255),
      inGamut: true,
      usedC: oklch.C,
    };
  }

  // 二分搜索最大可显示 chroma
  let lo = 0;
  let hi = Math.max(oklch.C, 0);
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    const test = oklchToLinearRgb({ L: oklch.L, C: mid, H: oklch.H });
    if (isInLinearGamut(test)) lo = mid;
    else hi = mid;
  }
  const clipped = oklchToLinearRgb({ L: oklch.L, C: lo, H: oklch.H });
  return {
    r: Math.round(linearToSrgb(clipped.r) * 255),
    g: Math.round(linearToSrgb(clipped.g) * 255),
    b: Math.round(linearToSrgb(clipped.b) * 255),
    inGamut: false,
    usedC: lo,
  };
}

// ---------- sRGB → OKLCH ----------

/** 0–255 sRGB → OKLCH */
export function rgbToOklch({ r, g, b }: Rgb): Oklch {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  // linear sRGB → LMS
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_ = cbrt(l);
  const m_ = cbrt(m);
  const s_ = cbrt(s);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bOk = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  const C = Math.sqrt(a * a + bOk * bOk);
  let H = (Math.atan2(bOk, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H };
}

// ---------- 字符串互转 ----------

/** rgb → 6 位 hex */
export function rgbToHex({ r, g, b }: Rgb): string {
  const h = (v: number) => v.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** hex → rgb；非法输入返回 null */
export function parseHex(input: string): Rgb | null {
  let s = input.trim().replace(/^#/, '');
  if (s.length === 3)
    s = s
      .split('')
      .map((c) => c + c)
      .join('');
  if (s.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(s)) return null;
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  };
}

/** `oklch(L C H)` 解析；L/C/H 可省略第三参数 → H = NaN 由调用方处理 */
export function parseOklch(input: string): Oklch | null {
  const m = input
    .trim()
    .match(
      /^oklch\(\s*([+-]?[\d.]+%?)\s+([+-]?[\d.]+%?)\s+([+-]?[\d.]+(?:deg)?)\s*\/?\s*([+-]?[\d.]+%?)?\s*\)$/i,
    );
  if (!m) return null;
  const L = m[1].endsWith('%') ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
  const C = m[2].endsWith('%') ? parseFloat(m[2]) / 100 : parseFloat(m[2]);
  const H = parseFloat(m[3]);
  if ([L, C, H].some((n) => !Number.isFinite(n))) return null;
  return { L, C, H };
}

/** 序列化成 CSS oklch 字符串（最多 3 位小数，去尾随零） */
export function formatOklch({ L, C, H }: Oklch): string {
  const round = (n: number, p = 3) => {
    const v = Math.round(n * 10 ** p) / 10 ** p;
    // 去尾随零再 toString，0.650 → "0.65"
    return Number.isInteger(v) ? v.toString() : v.toString();
  };
  return `oklch(${round(L)} ${round(C)} ${round(H)})`;
}

/** 序列化成 `rgb(r, g, b)` 字符串 */
export function formatRgb({ r, g, b }: Rgb): string {
  return `rgb(${r}, ${g}, ${b})`;
}

// ---------- 对比度（WCAG 2.1） ----------

/** sRGB 0–255 → 相对亮度 */
export function relativeLuminance({ r, g, b }: Rgb): number {
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}

/** WCAG 对比度比值（1–21），越大越易读 */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ---------- 和谐关系 ----------

/** 调色板生成：根据关系类型输出 2–5 个变体。H 取模 360，C/L 沿用基色。 */
export type HarmonyKind =
  | 'analogous'
  | 'complementary'
  | 'triadic'
  | 'splitComplement'
  | 'tetradic'
  | 'monochromatic';

export interface HarmonyVariant {
  /** 关系描述，比如 "H+30" */
  label: string;
  oklch: Oklch;
}

function shift(h: number, delta: number): number {
  return (((h + delta) % 360) + 360) % 360;
}

export function buildHarmony(base: Oklch, kind: HarmonyKind): HarmonyVariant[] {
  const { L, C, H } = base;
  switch (kind) {
    case 'analogous':
      return [
        { label: 'H-30', oklch: { L, C, H: shift(H, -30) } },
        { label: 'base', oklch: { L, C, H } },
        { label: 'H+30', oklch: { L, C, H: shift(H, 30) } },
      ];
    case 'complementary':
      return [
        { label: 'base', oklch: { L, C, H } },
        { label: 'H+180', oklch: { L, C, H: shift(H, 180) } },
      ];
    case 'triadic':
      return [
        { label: 'base', oklch: { L, C, H } },
        { label: 'H+120', oklch: { L, C, H: shift(H, 120) } },
        { label: 'H+240', oklch: { L, C, H: shift(H, 240) } },
      ];
    case 'splitComplement':
      return [
        { label: 'base', oklch: { L, C, H } },
        { label: 'H+150', oklch: { L, C, H: shift(H, 150) } },
        { label: 'H+210', oklch: { L, C, H: shift(H, 210) } },
      ];
    case 'tetradic':
      return [
        { label: 'base', oklch: { L, C, H } },
        { label: 'H+90', oklch: { L, C, H: shift(H, 90) } },
        { label: 'H+180', oklch: { L, C, H: shift(H, 180) } },
        { label: 'H+270', oklch: { L, C, H: shift(H, 270) } },
      ];
    case 'monochromatic': {
      // L 在 0.30/0.50/0.70/0.85 4 档，C 同步缩小让暗色仍可显示
      const levels = [0.32, 0.55, 0.75, 0.88];
      return levels.map((Lv, i) => ({
        label: `L ${Lv.toFixed(2)}`,
        oklch: { L: Lv, C: C * 0.85, H },
        // base 用 L=base.L，标签标 "base"
        ...(i === Math.floor(levels.length / 2) ? { label: 'base' } : {}),
      }));
    }
  }
}

// ---------- Vue 响应式封装 ----------

/**
 * OKLCH 工具 composable —— 把纯函数包成响应式。
 *
 * 单一来源的 L/C/H 状态 + 派生的 rgb/hex/contrast 字符串。
 * 提供预设（4 个 scheme 的 --accent）便于用户拉到工具里把玩。
 */
export interface UseOklchOptions {
  initial?: Oklch;
}

export function useOklch(options: UseOklchOptions = {}) {
  const L = ref(options.initial?.L ?? 0.65);
  const C = ref(options.initial?.C ?? 0.16);
  const H = ref(options.initial?.H ?? 250);

  const oklch = computed<Oklch>(() => ({ L: L.value, C: C.value, H: H.value }));
  const rgb = computed<RgbResult>(() => oklchToRgb(oklch.value));
  const hex = computed(() => rgbToHex(rgb.value));
  const oklchString = computed(() => formatOklch(oklch.value));
  const rgbString = computed(() => formatRgb(rgb.value));

  /** 从 hex 字符串反算 L/C/H（解析失败时静默） */
  function setFromHex(input: string): boolean {
    const parsed = parseHex(input);
    if (!parsed) return false;
    const o = rgbToOklch(parsed);
    L.value = o.L;
    C.value = o.C;
    H.value = o.H;
    return true;
  }

  /** 从 oklch() 字符串反算（解析失败时静默） */
  function setFromOklch(input: string): boolean {
    const parsed = parseOklch(input);
    if (!parsed) return false;
    L.value = parsed.L;
    C.value = parsed.C;
    H.value = parsed.H;
    return true;
  }

  /** 整组替换 */
  function setOklch(next: Oklch) {
    L.value = next.L;
    C.value = next.C;
    H.value = next.H;
  }

  return {
    L: L as Ref<number>,
    C: C as Ref<number>,
    H: H as Ref<number>,
    oklch,
    rgb,
    hex,
    oklchString,
    rgbString,
    setFromHex,
    setFromOklch,
    setOklch,
  };
}

export type UseOklchReturn = ReturnType<typeof useOklch>;
