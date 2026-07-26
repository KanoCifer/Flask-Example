// 配色元数据 — 名称/描述/hue 与 themes/*.css 注释对齐。
//
// hue 取自每个 css 文件里 token 的 oklch 第三参数（典型 --ink 的色调），
// 用于预览卡左侧的色带和分类视觉提示。
import type { SchemeMeta, TokenMeta } from '../types';

export const SCHEME_META: readonly SchemeMeta[] = [
  {
    id: 'paper',
    name: '纸色暖调',
    description: '米白纸张底，琥珀橙作主调，暖意最浓。',
    hue: 50,
  },
  {
    id: 'sage',
    name: '鼠尾草绿',
    description: '草本绿主调，搭配低饱和的陶土橙与冷蓝点缀。',
    hue: 145,
  },
  {
    id: 'mist',
    name: '雾蓝冷调',
    description: '雾蓝冷调主轴，珊瑚橙作反差，整体克制理性。',
    hue: 225,
  },
  {
    id: 'blush',
    name: '薄红陶色',
    description: '陶红低饱和主调，玫瑰红作强调，柔和而有温度。',
    hue: 355,
  },
] as const;

/** 完整 token 列表 — 顺序即在预览卡里的展示顺序 */
export const TOKEN_META: readonly TokenMeta[] = [
  // surface
  { name: 'page', label: 'page', hint: '页面底色', group: 'surface' },
  { name: 'card', label: 'card', hint: '卡片底色', group: 'surface' },
  { name: 'surface', label: 'surface', hint: '毛玻璃面', group: 'surface' },
  { name: 'secondary', label: 'secondary', hint: '次级面', group: 'surface' },
  { name: 'border', label: 'border', hint: '边框色', group: 'surface' },

  // text
  { name: 'ink', label: 'ink', hint: '正文文字', group: 'text' },
  { name: 'muted-text', label: 'muted', hint: '次要文字', group: 'text' },

  // accent
  { name: 'accent', label: 'accent', hint: '主强调', group: 'accent' },
  {
    name: 'accent-rose',
    label: 'accent-rose',
    hint: '玫强调',
    group: 'accent',
  },
  {
    name: 'accent-slate',
    label: 'accent-slate',
    hint: '冷强调',
    group: 'accent',
  },
  {
    name: 'contrast',
    label: 'contrast',
    hint: '强调之上文字',
    group: 'accent',
  },

  // charts
  { name: 'chart-1', label: 'chart-1', group: 'chart' },
  { name: 'chart-2', label: 'chart-2', group: 'chart' },
  { name: 'chart-3', label: 'chart-3', group: 'chart' },
  { name: 'chart-4', label: 'chart-4', group: 'chart' },
  { name: 'chart-5', label: 'chart-5', group: 'chart' },

  // gradient
  { name: 'gradient-primary-from', label: 'primary-from', group: 'gradient' },
  { name: 'gradient-primary-to', label: 'primary-to', group: 'gradient' },
  {
    name: 'gradient-decorative-from',
    label: 'decorative-from',
    group: 'gradient',
  },
  { name: 'gradient-decorative-to', label: 'decorative-to', group: 'gradient' },
] as const;

export const TOKEN_GROUPS = [
  { key: 'surface', label: '底面' },
  { key: 'text', label: '文字' },
  { key: 'accent', label: '强调' },
  { key: 'chart', label: '图表' },
  { key: 'gradient', label: '渐变' },
] as const;
