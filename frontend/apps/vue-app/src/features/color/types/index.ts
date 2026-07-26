// 配色模块类型导出 — 只放对外公开的类型。
import type { ColorScheme } from '@/stores';

export type { ColorScheme };

/** 单个 token 在配色中的元数据 */
export interface TokenMeta {
  /** CSS 变量名（不含 var()） */
  name: string;
  /** 中文标签 */
  label: string;
  /** 英文副标题（鼠标悬停说明） */
  hint?: string;
  /** 分组 */
  group: 'surface' | 'text' | 'accent' | 'chart' | 'gradient';
}

/** 一个 scheme 的完整元数据 */
export interface SchemeMeta {
  id: ColorScheme;
  /** 中文名（取自 themes/*.css 注释） */
  name: string;
  /** 一句话气质描述 */
  description: string;
  /** hue 角度 (oklch 第三参数 / 360)，用于预览卡左侧色带 */
  hue: number;
}
