// 本地-only 类型 —— 不存在于 @readinglist/types 共享包。

export interface ADDBookForm {
  title: string;
  author: string;
  iscompleted: boolean;
}

// 留言板类型定义（管理界面用）
export interface Message {
  id: string;
  name: string;
  message: string;
  created_at: string;
  review: number;
  from_admin?: boolean;
}

// 目录项类型定义
export interface TocItem {
  id: string;
  text: string;
  level: number;
}

// 徽章类型定义
export interface Badge {
  text: string;
  type: 'default' | 'success' | 'error' | 'warning' | 'info';
}

// ── 共享类型 re-export —— 单一真源在 @readinglist/types ──

export type {
  // common
  ApiResponse,
  Pagination,
  // blog
  Post,
  BlogPost,
  TagItem,
  PostsByTagResponse,
  BlogPagination,
  BlogsResponse,
  PostResponse,
  // auth
  LoginForm,
  ProfileForm,
  RegisterForm,
  UserInfo,
  // rss
  RssArticle,
  RssSubscription,
  RssArticleListResponse,
  // moment
  MomentVisibility,
  MomentStatus,
  MomentAttachmentType,
  MomentAttachment,
  MomentLocation,
  Moment,
  MomentListResponse,
  MomentCreatePayload,
  MomentUpdatePayload,
} from '@readinglist/types';
