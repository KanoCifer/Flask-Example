import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { blogGateway } from '@/features/blog/api/blogGateway';

vi.mock('@/api/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import apiClient from '@/api/apiClient';

describe('blogGateway (React — tags migration)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getTags', () => {
    it('calls /v1/tags and returns the response', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: {
          tags: [
            { name: 'python', count: 2 },
            { name: 'go', count: 1 },
          ],
        },
      });

      const gateway = blogGateway();
      const resp = await gateway.getTags();

      expect(apiClient.get).toHaveBeenCalledWith('v3/tags');
      expect(resp.data).toEqual({
        tags: [
          { name: 'python', count: 2 },
          { name: 'go', count: 1 },
        ],
      });
    });
  });

  describe('getPostsByTag', () => {
    it('URL-encodes the tag', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
        data: {
          posts: [{ _id: '1', title: 'A', tags: ['C++'] }],
          tag: 'C++',
          total: 1,
        },
      });

      const gateway = blogGateway();
      const resp = await gateway.getPostsByTag('C++');

      expect(apiClient.get).toHaveBeenCalledWith('v3/tags/C%2B%2B/posts');
      expect(resp.data.tag).toBe('C++');
    });
  });

  describe('createLegacyPost', () => {
    it('sends tags, not category_id', async () => {
      vi.mocked(apiClient.post).mockResolvedValue({
        data: { _id: 'new' },
      });

      const gateway = blogGateway();
      await gateway.createLegacyPost({
        title: 'T',
        body: 'B',
        tags: ['x'],
        is_pinned: 0,
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        'v3/post/add',
        expect.objectContaining({ tags: ['x'] }),
      );
      expect(apiClient.post).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ category_id: expect.anything() }),
      );
    });
  });

  describe('updateLegacyPost', () => {
    it('sends tags, not category_id', async () => {
      vi.mocked(apiClient.put).mockResolvedValue({
        data: { _id: 'existing' },
      });

      const gateway = blogGateway();
      await gateway.updateLegacyPost({
        _id: 'existing',
        title: 'T',
        body: 'B',
        tags: ['y'],
        is_pinned: 0,
      });

      expect(apiClient.put).toHaveBeenCalledWith(
        'v3/post/update',
        expect.objectContaining({ tags: ['y'] }),
      );
      expect(apiClient.put).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ category_id: expect.anything() }),
      );
    });
  });
});
