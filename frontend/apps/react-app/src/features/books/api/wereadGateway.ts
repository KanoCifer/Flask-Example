// 微信阅读网关已迁移到 @readinglist/api，此处重新导出以保持兼容

export { wereadGateway } from '@readinglist/api';
export type { WereadGateway } from '@readinglist/api';

// 领域类型 —— 真源在 @readinglist/types，桶重新导出以保持兼容
export type {
  BookRecommendItem,
  WereadUserBook,
  WereadArchive,
  WereadBookDetail,
  WereadBookProgress,
  WereadReadProgressData,
  WereadShelfData,
  WereadYearlyHeatmap,
} from '@readinglist/types';
