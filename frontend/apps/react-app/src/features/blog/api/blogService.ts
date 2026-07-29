import { blogGateway } from '@readinglist/api';
import type {
  BlogPost,
  BlogPagination,
  PostsByTagResponse,
  TagItem,
} from '@readinglist/types';

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
    is_pinned: boolean;
  }): Promise<{ _id: string }>;
  updateLegacyPost(payload: {
    _id: string;
    title: string;
    body: string;
    tags: string[];
    cover?: string | null;
    is_pinned: boolean;
  }): Promise<{ _id: string }>;
  deleteLegacyPost(postId: string): Promise<void>;
}

// 将 BlogPost 映射为 React 侧展示用的 BlogListItem
function toListItem(post: BlogPost): BlogListItem {
  return {
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
  };
}

function toDetail(post: BlogPost): BlogDetail {
  return {
    _id: post._id,
    title: post.title,
    body: post.body,
    cover: post.cover,
    tags: post.tags || [],
    is_pinned: post.is_pinned || false,
    views: post.views,
    likes: post.likes,
    created_at: post.created_at,
    updated_at: post.updated_at,
    summary: post.summary || undefined,
  };
}

export const blogService = (): BlogService => ({
  async getBlogs(query) {
    const raw = await blogGateway.getBlogs(query);
    const posts: BlogListItem[] = raw.posts.map(toListItem);
    return {
      posts,
      tags: raw.tags,
      pagination: raw.pagination,
    };
  },

  async getBlogPost(postId: string) {
    const raw = await blogGateway.getBlogPost(postId);
    return toDetail(raw);
  },

  async likePost(postId: string) {
    return blogGateway.likePost(postId);
  },

  async getTags() {
    return blogGateway.getTags();
  },

  async getPostsByTag(tag: string) {
    return blogGateway.getPostsByTag(tag);
  },

  async getLegacyPost(postId) {
    const raw = await blogGateway.getLegacyPost(postId);
    return toDetail(raw);
  },

  async createLegacyPost(payload) {
    return blogGateway.createLegacyPost(payload);
  },

  async updateLegacyPost(payload) {
    return blogGateway.updateLegacyPost(payload);
  },

  async deleteLegacyPost(postId) {
    await blogGateway.deleteLegacyPost(postId);
  },
});
