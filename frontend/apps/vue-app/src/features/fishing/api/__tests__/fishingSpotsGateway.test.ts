import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock 底层 apiClient —— 网关已迁移到 @readinglist/api。
// 使用 vi.hoisted 确保 mock 函数在 vi.mock 工厂之前初始化。
const { mockGet, mockPost, mockPatch, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPatch: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('@readinglist/api', () => {
  const apiClient = {
    get: mockGet,
    post: mockPost,
    patch: mockPatch,
    delete: mockDelete,
  };

  return {
    apiClient,
    fishingSpotGateway: {
      async list() {
        const res = await apiClient.get('v3/fish/spots');
        return res.data.data;
      },
      async getByID(id: string) {
        const res = await apiClient.get(`v3/fish/spots/${id}`);
        return res.data.data;
      },
      async create(payload: unknown) {
        await apiClient.post('v3/fish/spots', payload);
      },
      async update(id: string, payload: unknown) {
        await apiClient.patch(`v3/fish/spots/${id}`, payload);
      },
      async remove(id: string, options: { hard?: boolean } = {}) {
        await apiClient.delete(`v3/fish/spots/${id}`, {
          params: { hard: options.hard ? 'true' : undefined },
        });
      },
    },
  };
});

import { fishingSpotGateway } from '@readinglist/api';
import type { FishingSpot } from '@readinglist/types';

const sampleSpot: FishingSpot = {
  id: '64b8',
  name: 'Test Spot',
  description: 'desc',
  location: [113.399705, 23.067563],
  kind: 'river',
  tags: ['river'],
  rating: 4.5,
  images: ['img1.png'],
  created_at: '2026-07-15T00:00:00Z',
  updated_at: '2026-07-15T00:00:00Z',
};

describe('fishingSpotsGateway', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('list', () => {
    it('GET v3/fish/spots 并解包 data', async () => {
      mockGet.mockResolvedValue({
        data: { data: [sampleSpot] },
      } as never);

      const result = await fishingSpotGateway.list();

      expect(mockGet).toHaveBeenCalledWith('v3/fish/spots');
      expect(result).toEqual([sampleSpot]);
    });
  });

  describe('getByID', () => {
    it('GET v3/fish/spots/:id 并解包 data', async () => {
      mockGet.mockResolvedValue({
        data: { data: sampleSpot },
      } as never);

      const result = await fishingSpotGateway.getByID('64b8');

      expect(mockGet).toHaveBeenCalledWith('v3/fish/spots/64b8');
      expect(result).toEqual(sampleSpot);
    });
  });

  describe('create', () => {
    it('POST v3/fish/spots 携带 payload', async () => {
      mockPost.mockResolvedValue({ data: { data: null } } as never);

      await fishingSpotGateway.create({
        name: 'New Spot',
        location: [113.4, 23.06],
        kind: 'lake',
        tags: ['lake'],
      });

      expect(mockPost).toHaveBeenCalledWith('v3/fish/spots', {
        name: 'New Spot',
        location: [113.4, 23.06],
        kind: 'lake',
        tags: ['lake'],
      });
    });
  });

  describe('update', () => {
    it('PATCH v3/fish/spots/:id 携带部分 payload', async () => {
      mockPatch.mockResolvedValue({ data: { data: null } } as never);

      await fishingSpotGateway.update('64b8', { rating: 5 });

      expect(mockPatch).toHaveBeenCalledWith('v3/fish/spots/64b8', {
        rating: 5,
      });
    });
  });

  describe('remove', () => {
    it('DELETE v3/fish/spots/:id 默认软删（无 hard 参数）', async () => {
      mockDelete.mockResolvedValue({ data: { data: null } } as never);

      await fishingSpotGateway.remove('64b8');

      expect(mockDelete).toHaveBeenCalledWith('v3/fish/spots/64b8', {
        params: { hard: undefined },
      });
    });

    it('DELETE v3/fish/spots/:id?hard=true 物理删除', async () => {
      mockDelete.mockResolvedValue({ data: { data: null } } as never);

      await fishingSpotGateway.remove('64b8', { hard: true });

      expect(mockDelete).toHaveBeenCalledWith('v3/fish/spots/64b8', {
        params: { hard: 'true' },
      });
    });
  });
});
