import { apiClient } from '@/api/request';

import type { GalleryImage, GalleryResponse } from '@/features/pic/types';

export interface GalleryGateway {
  getGallery(): Promise<GalleryResponse>;
  saveGallery(payload: { images: GalleryImage[] }): Promise<void>;
}

export const galleryGateway: GalleryGateway = {
  async getGallery(): Promise<GalleryResponse> {
    const res = await apiClient.get<{ data: GalleryResponse }>(
      'v1/pic-gallery',
    );
    return res.data.data;
  },

  async saveGallery(payload: { images: GalleryImage[] }): Promise<void> {
    await apiClient.post('v1/set-pic-gallery', payload);
  },
};
