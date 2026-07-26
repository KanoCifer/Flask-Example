// ── 博客文章类型 ────────────────────────────────────────────────────────────
// Post = PostgreSQL 存储（id 主键），BlogPost = MongoDB 存储（_id 主键）

export interface Post {
  id?: number;
  _id?: string;
  title: string;
  content?: string;
  body: string;
  summary?: string;
  cover?: string;
  author_id?: number;
  author_name?: string;
  author?: string;
  views?: number;
  likes?: number;
  created_at: string;
  updated_at?: string;
  tags?: string[];
  is_pinned?: boolean;
}

export interface BlogPost {
  _id: string;
  title: string;
  body: string;
  summary?: string | null;
  cover?: string | null;
  views?: number;
  likes?: number;
  created_at: string;
  updated_at: string;
  tags: string[];
  is_pinned?: boolean;
}

/** 标签聚合项（带文章计数） */
export interface TagItem {
  name: string;
  count: number;
}

/** 标签筛选结果 */
export interface PostsByTagResponse {
  posts: BlogPost[];
  tag: string;
  total: number;
}

export interface BlogPagination {
  page: number;
  per_page: number;
  total: number;
  pages: number;
  has_prev: boolean;
  has_next: boolean;
  prev_num?: number | null;
  next_num?: number | null;
}

/** 博客列表查询参数 */
export interface BlogQuery {
  page?: number;
  search?: number;
}

/** 博客列表响应（v1/v2 旧格式，含 tags 聚合） */
export interface BlogsResponse {
  status: string;
  message: string;
  data: {
    posts: Post[];
    tags: TagItem[];
    pagination: BlogPagination;
  };
}

/** 博客列表响应（v3 新格式） */
export interface BlogListResponse {
  posts: BlogPost[];
  tags: TagItem[];
  pagination: BlogPagination;
}

/** 单篇文章响应（v3 格式，含 is_pinned / views / likes） */
export interface BlogPostResponse {
  _id: string;
  title: string;
  body: string;
  summary?: string | null;
  cover?: string | null;
  tags: string[];
  is_pinned: boolean;
  views?: number;
  likes?: number;
  created_at: string;
  updated_at: string;
}

export interface PostResponse {
  status: string;
  message: string;
  data: Post;
}
