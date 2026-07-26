import { apiClient } from '@/api/request';
import type {
  BlogListResponse,
  BlogPostResponse,
  BlogQuery,
  PostsByTagResponse,
  TagItem,
} from '@/features/blog/types';

export interface BlogGateway {
  getBlogs(query?: BlogQuery): Promise<BlogListResponse>;
  getBlogPost(postId: string): Promise<BlogPostResponse>;
  getTags(): Promise<TagItem[]>;
  getPostsByTag(tag: string): Promise<PostsByTagResponse>;
  likePost(postId: string): Promise<number>;
  getLegacyPost(postId: string): Promise<BlogPostResponse>;
  createLegacyPost(payload: {
    title: string;
    body: string;
    tags: string[];
    summary?: string | null;
    cover?: string | null;
    is_pinned: number;
  }): Promise<{ _id: string }>;
  updateLegacyPost(payload: {
    _id: string;
    title: string;
    body: string;
    tags: string[];
    summary?: string | null;
    cover?: string | null;
    is_pinned: number;
  }): Promise<{ _id: string }>;
  deleteLegacyPost(postId: string): Promise<void>;
}

export const blogGateway: BlogGateway = {
  async getBlogs(query?: BlogQuery): Promise<BlogListResponse> {
    const res = await apiClient.get<{ data: BlogListResponse }>('v3/blogs', {
      params: query,
    });
    return res.data.data;
  },

  async getBlogPost(postId: string): Promise<BlogPostResponse> {
    const res = await apiClient.get<{ data: BlogPostResponse }>(
      `v3/blogs/${postId}`,
    );
    return res.data.data;
  },

  async getTags(): Promise<TagItem[]> {
    const res = await apiClient.get<{ data: { tags: TagItem[] } }>('v3/tags');
    return res.data.data.tags;
  },

  async getPostsByTag(tag: string): Promise<PostsByTagResponse> {
    const res = await apiClient.get<{ data: PostsByTagResponse }>(
      `v3/tags/${encodeURIComponent(tag)}/posts`,
    );
    return res.data.data;
  },

  async likePost(postId: string): Promise<number> {
    const res = await apiClient.post<{ data: { likes: number } }>(
      `v3/blogs/${postId}/like`,
    );
    return res.data.data.likes;
  },

  async getLegacyPost(postId: string): Promise<BlogPostResponse> {
    const res = await apiClient.get<{ data: BlogPostResponse }>('v3/post', {
      params: { _id: postId },
    });
    return res.data.data;
  },

  async createLegacyPost(payload): Promise<{ _id: string }> {
    const res = await apiClient.post<{ data: { _id: string } }>(
      'v3/post/add',
      payload,
    );
    return res.data.data;
  },

  async updateLegacyPost(payload): Promise<{ _id: string }> {
    const res = await apiClient.put<{ data: { _id: string } }>(
      'v3/post/update',
      payload,
    );
    return res.data.data;
  },

  async deleteLegacyPost(postId: string): Promise<void> {
    await apiClient.delete(`v3/post/${postId}/delete`);
  },
};
