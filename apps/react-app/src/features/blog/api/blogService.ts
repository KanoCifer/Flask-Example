import { blogGateway } from '@/features/blog/api/blogGateway';
import { extractData } from '@/api/apiClient';
import type { ApiResponse } from '@/api/apiClient';
import type {
  BlogPost,
  BlogPagination,
  PostsByTagResponse,
  TagItem,
} from '@/types';

// 博客列表项（处理后的）
export interface BlogListItem {
  _id: string;
  title: string;
  body: string;
  summary: string;
  cover?: string | null;
  tags: string[];
  is_pinned: boolean;
  views?: number;
  created_at: string;
  updated_at: string;
}

// 博客列表（处理后的）
export interface BlogList {
  posts: BlogListItem[];
  tags: TagItem[];
  pagination: BlogPagination;
}

// 博客详情（处理后的）
export interface BlogDetail {
  _id: string;
  title: string;
  body: string;
  cover?: string | null;
  tags: string[];
  is_pinned: boolean;
  views?: number;
  likes?: number;
  created_at: string;
  updated_at: string;
  author?: string;
  summary?: string;
}

export interface BlogService {
  getBlogs(query?: { page?: number; search?: string }): Promise<BlogList>;
  getBlogPost(postId: string): Promise<BlogDetail>;
  likePost(postId: string): Promise<number>;
  getTags(): Promise<TagItem[]>;
  getPostsByTag(tag: string): Promise<PostsByTagResponse>;
  // Legacy endpoints
  getLegacyPost(postId: string): Promise<BlogDetail>;
  createLegacyPost(payload: {
    title: string;
    body: string;
    tags: string[];
    cover?: string | null;
    is_pinned: number;
  }): Promise<{ _id: string }>;
  updateLegacyPost(payload: {
    _id: string;
    title: string;
    body: string;
    tags: string[];
    cover?: string | null;
    is_pinned: number;
  }): Promise<{ _id: string }>;
  deleteLegacyPost(postId: string): Promise<void>;
}

export const blogService = (): BlogService => {
  const gateway = blogGateway();

  return {
    async getBlogs(query) {
      const res = await gateway.getBlogs(query);
      const raw = extractData(
        res as unknown as { data: ApiResponse<unknown> },
      ) as {
        posts: BlogPost[];
        tags: TagItem[];
        pagination: BlogPagination;
      };

      const posts: BlogListItem[] = raw.posts.map((post) => ({
        _id: post._id,
        title: post.title,
        body: post.body,
        summary: post.summary || '',
        cover: post.cover,
        tags: post.tags || [],
        is_pinned: post.is_pinned || false,
        views: post.views,
        created_at: post.created_at,
        updated_at: post.updated_at,
      }));

      return {
        posts,
        tags: raw.tags,
        pagination: raw.pagination,
      };
    },

    async getBlogPost(postId: string) {
      const res = await gateway.getBlogPost(postId);
      return extractData(
        res as unknown as { data: ApiResponse<unknown> },
      ) as BlogDetail;
    },

    async likePost(postId: string) {
      const res = await gateway.likePost(postId);
      const data = extractData(
        res as unknown as { data: ApiResponse<unknown> },
      ) as { likes: number };
      return data.likes;
    },

    async getTags() {
      const res = await gateway.getTags();
      const data = extractData(
        res as unknown as { data: ApiResponse<unknown> },
      );
      // gateway 返回 { data: { tags: [...] } } — unwrap
      return (data as unknown as { tags: TagItem[] }).tags ?? [];
    },

    async getPostsByTag(tag: string) {
      const res = await gateway.getPostsByTag(tag);
      return extractData(res as unknown as { data: ApiResponse<unknown> }) as {
        posts: BlogPost[];
        tag: string;
        total: number;
      };
    },

    async getLegacyPost(postId) {
      const res = await gateway.getLegacyPost(postId);
      return extractData(
        res as unknown as { data: ApiResponse<unknown> },
      ) as BlogDetail;
    },

    async createLegacyPost(payload) {
      const res = await gateway.createLegacyPost(payload);
      return extractData(res as unknown as { data: ApiResponse<unknown> }) as {
        _id: string;
      };
    },

    async updateLegacyPost(payload) {
      const res = await gateway.updateLegacyPost(payload);
      return extractData(res as unknown as { data: ApiResponse<unknown> }) as {
        _id: string;
      };
    },

    async deleteLegacyPost(postId) {
      await gateway.deleteLegacyPost(postId);
    },
  };
};
