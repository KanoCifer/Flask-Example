// 竞态守卫已迁移到 @readinglist/utils，此处重新导出以保持兼容
import { createSequencedTask, type SequencedResult } from '@readinglist/utils';

export { createSequencedTask, type SequencedResult };

/** @deprecated 使用 createSequencedTask 代替 — 保留以兼容现有 import */
export const useSequencedTask = createSequencedTask;
