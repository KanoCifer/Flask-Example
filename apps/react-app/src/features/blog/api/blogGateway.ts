import type { AxiosResponse } from 'axios';

import apiClient from '@/api/apiClient';
import type {
  BlogPagination,
  BlogPost,
  PostsByTagResponse,
  TagItem,
} from '@/types';

interface BlogQuery {
  page?: number;
  search?: string;
}

interface BlogListResponse {
  posts: BlogPost[];
  tags: TagItem[];
  pagination: BlogPagination;
}

interface BlogPostResponse {
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
}

export interface blogGateway {
  getBlogs(query?: BlogQuery): Promise<AxiosResponse<BlogListResponse>>;
  getBlogPost(postId: string): Promise<AxiosResponse<BlogPostResponse>>;
  likePost(postId: string): Promise<AxiosResponse<{ likes: number }>>;
  getTags(): Promise<AxiosResponse<{ tags: TagItem[] }>>;
  getPostsByTag(tag: string): Promise<AxiosResponse<PostsByTagResponse>>;
  // Legacy endpoints
  getLegacyPost(postId: string): Promise<AxiosResponse<BlogPostResponse>>;
  createLegacyPost(payload: {
    title: string;
    body: string;
    tags: string[];
    cover?: string | null;
    is_pinned: number;
  }): Promise<AxiosResponse<{ _id: string }>>;
  updateLegacyPost(payload: {
    _id: string;
    title: string;
    body: string;
    tags: string[];
    cover?: string | null;
    is_pinned: number;
  }): Promise<AxiosResponse<{ _id: string }>>;
  deleteLegacyPost(postId: string): Promise<AxiosResponse<void>>;
}

export const blogGateway = (): blogGateway => {
  return {
    async getBlogs(query?: BlogQuery) {
      return apiClient.get('v3/blogs', { params: query }) as Promise<
        AxiosResponse<BlogListResponse>
      >;
    },

    async getBlogPost(postId: string) {
      return apiClient.get(`v3/blogs/${postId}`) as Promise<
        AxiosResponse<BlogPostResponse>
      >;
    },

    async likePost(postId: string) {
      return apiClient.post(`v3/blogs/${postId}/like`) as Promise<
        AxiosResponse<{ likes: number }>
      >;
    },

    async getTags() {
      return apiClient.get('v3/tags') as Promise<
        AxiosResponse<{ tags: TagItem[] }>
      >;
    },

    async getPostsByTag(tag: string) {
      return apiClient.get(
        `v3/tags/${encodeURIComponent(tag)}/posts`,
      ) as Promise<AxiosResponse<PostsByTagResponse>>;
    },

    async getLegacyPost(postId: string) {
      return apiClient.get('v3/post', { params: { _id: postId } }) as Promise<
        AxiosResponse<BlogPostResponse>
      >;
    },

    async createLegacyPost(payload) {
      return apiClient.post('v3/post/add', payload) as Promise<
        AxiosResponse<{ _id: string }>
      >;
    },

    async updateLegacyPost(payload) {
      return apiClient.put('v3/post/update', payload) as Promise<
        AxiosResponse<{ _id: string }>
      >;
    },

    async deleteLegacyPost(postId: string) {
      return apiClient.delete(`v3/post/${postId}/delete`) as Promise<
        AxiosResponse<void>
      >;
    },
  };
};
