import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Single stable mock instance so beforeEach + tests share fns
const gatewayMock = {
  getBlogs: vi.fn(),
  getBlogPost: vi.fn(),
  getTags: vi.fn(),
  getPostsByTag: vi.fn(),
  getLegacyPost: vi.fn(),
  createLegacyPost: vi.fn(),
  updateLegacyPost: vi.fn(),
  deleteLegacyPost: vi.fn(),
};

vi.mock('@/features/blog/api/blogGateway', () => ({
  blogGateway: () => gatewayMock,
}));

vi.mock('@/api/request', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/apiClient')>();
  return {
    ...actual,
    // Real extractData does res.data.data (AxiosResponse → ApiResponse).
    // Our mocks return { data: { data: T } } to match that shape.
    extractData: <T>(res: unknown): T =>
      (res as { data: { data: T } }).data.data as T,
  };
});

// Import AFTER mocks so blogService picks up mocked request module
import { blogService } from '@/features/blog/api/blogService';

describe('blogService (React — tags migration)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Default mocks so individual tests only override what they exercise
    gatewayMock.getBlogs.mockResolvedValue({
      data: { data: { posts: [], tags: [], pagination: {} } },
    } as never);
    gatewayMock.getTags.mockResolvedValue({
      data: { data: { tags: [] } },
    } as never);
    gatewayMock.getPostsByTag.mockResolvedValue({
      data: { data: { posts: [], tag: '', total: 0 } },
    } as never);
    gatewayMock.getLegacyPost.mockResolvedValue({
      data: { data: { _id: '', title: '', body: '', tags: [] } },
    } as never);
    gatewayMock.createLegacyPost.mockResolvedValue({
      data: { data: { _id: '' } },
    } as never);
    gatewayMock.updateLegacyPost.mockResolvedValue({
      data: { data: { _id: '' } },
    } as never);
    gatewayMock.getBlogPost.mockResolvedValue({
      data: { _id: '', title: '', body: '', tags: [] },
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getBlogs', () => {
    it('returns posts with tags array (no category)', async () => {
      vi.mocked(gatewayMock.getBlogs).mockResolvedValue({
        data: {
          data: {
            posts: [
              {
                _id: '1',
                title: 'A',
                body: 'B',
                summary: 'S',
                tags: ['python'],
                is_pinned: false,
                created_at: '2026-01-01',
                updated_at: '2026-01-01',
              },
            ],
            tags: [{ name: 'python', count: 1 }],
            pagination: {
              page: 1,
              per_page: 10,
              total: 1,
              pages: 1,
              has_prev: false,
              has_next: false,
            },
          },
        },
      });

      const svc = blogService();
      const result = await svc.getBlogs({ page: 1 });

      expect(result.posts[0].tags).toEqual(['python']);
      expect(result.posts[0]).not.toHaveProperty('category');
      expect(result.tags).toEqual([{ name: 'python', count: 1 }]);
      expect(result).not.toHaveProperty('categories');
      expect(result).not.toHaveProperty('categoryCounts');
    });
  });

  describe('getTags', () => {
    it('unwraps { tags: [...] } envelope', async () => {
      vi.mocked(gatewayMock.getTags).mockResolvedValue({
        data: {
          data: {
            tags: [
              { name: 'a', count: 1 },
              { name: 'b', count: 2 },
            ],
          },
        },
      } as never);

      const svc = blogService();
      const tags = await svc.getTags();

      expect(tags).toEqual([
        { name: 'a', count: 1 },
        { name: 'b', count: 2 },
      ]);
    });
  });

  describe('getPostsByTag', () => {
    it('posts carry tags, not category', async () => {
      vi.mocked(gatewayMock.getPostsByTag).mockResolvedValue({
        data: {
          data: {
            posts: [
              {
                _id: '1',
                title: 'A',
                body: 'B',
                tags: ['vue'],
                is_pinned: false,
                created_at: '2026-01-01',
                updated_at: '2026-01-01',
              },
            ],
            tag: 'vue',
            total: 1,
          },
        },
      } as never);

      const svc = blogService();
      const result = await svc.getPostsByTag('vue');

      expect(result.tag).toBe('vue');
      expect(result.posts[0].tags).toEqual(['vue']);
      expect(result.posts[0]).not.toHaveProperty('category');
    });
  });

  describe('createLegacyPost', () => {
    it('forwards tags, not category_id', async () => {
      vi.mocked(gatewayMock.createLegacyPost).mockResolvedValue({
        data: { data: { _id: 'new' } },
      } as never);

      const svc = blogService();
      await svc.createLegacyPost({
        title: 'T',
        body: 'B',
        tags: ['x'],
        is_pinned: 0,
      });

      expect(gatewayMock.createLegacyPost).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ['x'] }),
      );
      expect(gatewayMock.createLegacyPost).not.toHaveBeenCalledWith(
        expect.objectContaining({ category_id: expect.anything() }),
      );
    });
  });

  describe('updateLegacyPost', () => {
    it('forwards tags, not category_id', async () => {
      vi.mocked(gatewayMock.updateLegacyPost).mockResolvedValue({
        data: { data: { _id: 'existing' } },
      } as never);

      const svc = blogService();
      await svc.updateLegacyPost({
        _id: 'existing',
        title: 'T',
        body: 'B',
        tags: ['y'],
        is_pinned: 0,
      });

      expect(gatewayMock.updateLegacyPost).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ['y'] }),
      );
      expect(gatewayMock.updateLegacyPost).not.toHaveBeenCalledWith(
        expect.objectContaining({ category_id: expect.anything() }),
      );
    });
  });

  describe('getLegacyPost', () => {
    it('returns tags, no category field', async () => {
      vi.mocked(gatewayMock.getLegacyPost).mockResolvedValue({
        data: {
          data: {
            _id: '1',
            title: 'T',
            body: 'B',
            tags: ['z'],
            is_pinned: false,
            created_at: '2026-01-01',
            updated_at: '2026-01-01',
          },
        },
      } as never);

      const svc = blogService();
      const result = await svc.getLegacyPost('1');

      expect(result.tags).toEqual(['z']);
      expect(result).not.toHaveProperty('category');
    });
  });
});
