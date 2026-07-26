// 博客文章类型
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
  created_at: string;
  updated_at: string;
  tags: string[];
}

export interface TagItem {
  name: string;
  count: number;
}

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

// ---------------------------------------------------------------------------
// 博客查询 / 响应 DTO
// ---------------------------------------------------------------------------

export interface BlogQuery {
  page?: number;
  search?: string;
}

export interface BlogListResponse {
  posts: BlogPost[];
  tags: TagItem[];
  pagination: BlogPagination;
}

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
