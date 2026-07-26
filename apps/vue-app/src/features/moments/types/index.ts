// 碎碎念（Moments）类型定义 — MongoDB / moments 集合

export type MomentVisibility = 'public' | 'private' | 'unlisted';
export type MomentStatus = 'published' | 'draft' | 'archived';
export type MomentAttachmentType = 'image' | 'link' | 'book' | 'quote';

export interface MomentAttachment {
  type: MomentAttachmentType;
  url: string;
  thumbnail_url?: string | null;
  title?: string | null;
  description?: string | null;
  meta?: Record<string, unknown> | null;
}

export interface MomentLocation {
  name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface Moment {
  id: string;
  user_id: number;
  content: string;
  summary?: string | null;
  visibility: MomentVisibility;
  status: MomentStatus;
  mood?: string | null;
  tags: string[];
  attachments: MomentAttachment[];
  location?: MomentLocation | null;
  source?: string | null;
  is_pinned: boolean;
  allow_comment: boolean;
  like_count: number;
  comment_count: number;
  view_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MomentListResponse {
  moments: Moment[];
  total: number;
  page: number;
  page_size: number;
}

export interface MomentCreatePayload {
  content: string;
  summary?: string | null;
  visibility?: MomentVisibility;
  status?: MomentStatus;
  mood?: string | null;
  tags?: string[];
  attachments?: MomentAttachment[];
  location?: MomentLocation | null;
  source?: string | null;
  is_pinned?: boolean;
  allow_comment?: boolean;
  published_at?: string | null;
}

export type MomentUpdatePayload = Partial<MomentCreatePayload>;

// ---------------------------------------------------------------------------
// 列表查询参数
// ---------------------------------------------------------------------------

export interface ListPublicMomentsParams {
  page?: number;
  page_size?: number;
  tag?: string;
}

export interface ListAdminMomentsParams {
  page?: number;
  page_size?: number;
  status?: MomentStatus;
}
