import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the underlying apiClient module —— 与 blogGateway.test.ts 同模式。
vi.mock('@/api/request', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from '@/api/request';
import { fishingSpotsGateway } from '@/features/fishing/api/fishingSpotsGateway';
import type { FishingSpot } from '@/features/fishing/types';

const mockedRequest = vi.mocked(apiClient);

const sampleSpot: FishingSpot = {
  id: '64b8',
  name: 'Test Spot',
  description: 'desc',
  location: [113.399705, 23.067563],
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
      mockedRequest.get.mockResolvedValue({
        data: { data: [sampleSpot] },
      });

      const result = await fishingSpotsGateway.list();

      expect(mockedRequest.get).toHaveBeenCalledWith('v3/fish/spots');
      expect(result).toEqual([sampleSpot]);
    });
  });

  describe('getByID', () => {
    it('GET v3/fish/spots/:id 并解包 data', async () => {
      mockedRequest.get.mockResolvedValue({
        data: { data: sampleSpot },
      });

      const result = await fishingSpotsGateway.getByID('64b8');

      expect(mockedRequest.get).toHaveBeenCalledWith('v3/fish/spots/64b8');
      expect(result).toEqual(sampleSpot);
    });
  });

  describe('create', () => {
    it('POST v3/fish/spots 携带 payload', async () => {
      mockedRequest.post.mockResolvedValue({ data: { data: null } });

      await fishingSpotsGateway.create({
        name: 'New Spot',
        location: [113.4, 23.06],
        tags: ['lake'],
      });

      expect(mockedRequest.post).toHaveBeenCalledWith('v3/fish/spots', {
        name: 'New Spot',
        location: [113.4, 23.06],
        tags: ['lake'],
      });
    });
  });

  describe('update', () => {
    it('PATCH v3/fish/spots/:id 携带部分 payload', async () => {
      mockedRequest.patch.mockResolvedValue({ data: { data: null } });

      await fishingSpotsGateway.update('64b8', { rating: 5 });

      expect(mockedRequest.patch).toHaveBeenCalledWith('v3/fish/spots/64b8', {
        rating: 5,
      });
    });
  });

  describe('remove', () => {
    it('DELETE v3/fish/spots/:id 默认软删（无 hard 参数）', async () => {
      mockedRequest.delete.mockResolvedValue({ data: { data: null } });

      await fishingSpotsGateway.remove('64b8');

      expect(mockedRequest.delete).toHaveBeenCalledWith('v3/fish/spots/64b8', {
        params: { hard: undefined },
      });
    });

    it('DELETE v3/fish/spots/:id?hard=true 物理删除', async () => {
      mockedRequest.delete.mockResolvedValue({ data: { data: null } });

      await fishingSpotsGateway.remove('64b8', { hard: true });

      expect(mockedRequest.delete).toHaveBeenCalledWith('v3/fish/spots/64b8', {
        params: { hard: 'true' },
      });
    });
  });
});
