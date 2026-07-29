// blog API 网关桶导出（blog/public 网关统一收口）

export { blogGateway, socialGateway } from '@readinglist/api';
export type { BlogGateway, SocialGateway } from '@readinglist/api';

// 博客领域类型 —— 真源在 @readinglist/types，桶重新导出以保持兼容
export type {
  BlogListResponse,
  BlogPostResponse,
  BlogQuery,
} from '@readinglist/types';
