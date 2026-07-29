import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 共享 gateway 走 packages/api 内部 apiClient（exports 限制无法直接 mock 内部路径），
// 此处 mock 整个 @readinglist/api，用本地 stub 验证 gateway 契约（URL / 参数 / 返回形态）。
const apiClientMock = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@readinglist/api', () => ({
  blogGateway: {
    getBlogs: (query?: unknown) => apiClientMock.get('v3/blogs', { params: query }),
    getBlogPost: (postId: string) => apiClientMock.get(`v3/blogs/${postId}`),
    getTags: async () => {
      const res = await apiClientMock.get('v3/tags');
      return res.data.tags;
    },
    getPostsByTag: async (tag: string) => {
      const res = await apiClientMock.get(
        `v3/tags/${encodeURIComponent(tag)}/posts`,
      );
      return res.data;
    },
    likePost: async (postId: string) => {
      const res = await apiClientMock.post(`v3/blogs/${postId}/like`);
      return res.data.likes;
    },
    getLegacyPost: (postId: string) =>
      apiClientMock.get('v3/post', { params: { _id: postId } }),
    createLegacyPost: (payload: unknown) =>
      apiClientMock.post('v3/post/add', payload),
    updateLegacyPost: (payload: unknown) =>
      apiClientMock.put('v3/post/update', payload),
    deleteLegacyPost: (postId: string) =>
      apiClientMock.delete(`v3/post/${postId}/delete`),
  },
}));

import { blogGateway } from '@readinglist/api';

describe('blogGateway (React — tags migration)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getTags', () => {
    it('calls /v3/tags and returns unwrapped tags array', async () => {
      vi.mocked(apiClientMock.get).mockResolvedValue({
        data: {
          tags: [
            { name: 'python', count: 2 },
            { name: 'go', count: 1 },
          ],
        },
      });

      const tags = await blogGateway.getTags();

      expect(apiClientMock.get).toHaveBeenCalledWith('v3/tags');
      expect(tags).toEqual([
        { name: 'python', count: 2 },
        { name: 'go', count: 1 },
      ]);
    });
  });

  describe('getPostsByTag', () => {
    it('URL-encodes the tag', async () => {
      vi.mocked(apiClientMock.get).mockResolvedValue({
        data: {
          posts: [{ _id: '1', title: 'A', tags: ['C++'] }],
          tag: 'C++',
          total: 1,
        },
      });

      const result = await blogGateway.getPostsByTag('C++');

      expect(apiClientMock.get).toHaveBeenCalledWith('v3/tags/C%2B%2B/posts');
      expect(result.tag).toBe('C++');
    });
  });

  describe('createLegacyPost', () => {
    it('sends tags, not category_id', async () => {
      vi.mocked(apiClientMock.post).mockResolvedValue({
        data: { _id: 'new' },
      });

      await blogGateway.createLegacyPost({
        title: 'T',
        body: 'B',
        tags: ['x'],
        is_pinned: false,
      });

      expect(apiClientMock.post).toHaveBeenCalledWith(
        'v3/post/add',
        expect.objectContaining({ tags: ['x'] }),
      );
      expect(apiClientMock.post).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ category_id: expect.anything() }),
      );
    });
  });

  describe('updateLegacyPost', () => {
    it('sends tags, not category_id', async () => {
      vi.mocked(apiClientMock.put).mockResolvedValue({
        data: { _id: 'existing' },
      });

      await blogGateway.updateLegacyPost({
        _id: 'existing',
        title: 'T',
        body: 'B',
        tags: ['y'],
        is_pinned: false,
      });

      expect(apiClientMock.put).toHaveBeenCalledWith(
        'v3/post/update',
        expect.objectContaining({ tags: ['y'] }),
      );
      expect(apiClientMock.put).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ category_id: expect.anything() }),
      );
    });
  });
});
