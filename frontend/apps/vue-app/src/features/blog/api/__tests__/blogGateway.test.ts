import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { blogGateway } from '@/features/blog/api/blogGateway';

// Mock the underlying apiClient module
vi.mock('@/api/request', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from '@/api/request';

describe('blogGateway (tags migration)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getTags', () => {
    it('returns flattened tag list from response', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: {
          data: {
            tags: [
              { name: 'python', count: 3 },
              { name: 'go', count: 1 },
            ],
          },
        },
      });

      const tags = await blogGateway.getTags();

      expect(apiClient.get).toHaveBeenCalledWith('v3/tags');
      expect(tags).toEqual([
        { name: 'python', count: 3 },
        { name: 'go', count: 1 },
      ]);
    });
  });

  describe('getPostsByTag', () => {
    it('URL-encodes the tag and unwraps response', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: {
          data: {
            posts: [{ _id: '1', title: 'A', tags: ['C++'] }],
            tag: 'C++',
            total: 1,
          },
        },
      });

      const result = await blogGateway.getPostsByTag('C++');

      expect(apiClient.get).toHaveBeenCalledWith('v3/tags/C%2B%2B/posts');
      expect(result.tag).toBe('C++');
      expect(result.total).toBe(1);
    });
  });

  describe('createLegacyPost', () => {
    it('sends tags (not category_id) in payload', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({
        data: { data: { _id: 'newid' } },
      });

      const result = await blogGateway.createLegacyPost({
        title: 'Hello',
        body: 'World',
        tags: ['a', 'b'],
        is_pinned: 0,
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        'v3/post/add',
        expect.objectContaining({
          title: 'Hello',
          body: 'World',
          tags: ['a', 'b'],
          is_pinned: 0,
        }),
      );
      // category_id must NOT be in the payload
      expect(apiClient.post).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ category_id: expect.anything() }),
      );
      expect(result._id).toBe('newid');
    });
  });

  describe('updateLegacyPost', () => {
    it('sends tags (not category_id) in update payload', async () => {
      vi.mocked(apiClient.put).mockResolvedValue({
        data: { data: { _id: 'existing' } },
      });

      await blogGateway.updateLegacyPost({
        _id: 'existing',
        title: 'New',
        body: 'Body',
        tags: ['new-tag'],
        is_pinned: 1,
      });

      expect(apiClient.put).toHaveBeenCalledWith(
        'v3/post/update',
        expect.objectContaining({
          _id: 'existing',
          tags: ['new-tag'],
        }),
      );
      expect(apiClient.put).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ category_id: expect.anything() }),
      );
    });
  });

  describe('getBlogs', () => {
    it('response contains tags (not categories)', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: {
          data: {
            posts: [{ _id: '1', title: 'P', tags: ['x'] }],
            tags: [{ name: 'x', count: 1 }],
            pagination: {
              page: 1,
              per_page: 10,
              total: 1,
              pages: 1,
              has_prev: false,
              has_next: false,
              prev_num: null,
              next_num: null,
            },
          },
        },
      });

      const result = await blogGateway.getBlogs({ page: 1 });

      expect(result.tags).toEqual([{ name: 'x', count: 1 }]);
      expect(result).not.toHaveProperty('categories');
      expect(result).not.toHaveProperty('category_counts');
    });
  });
});
