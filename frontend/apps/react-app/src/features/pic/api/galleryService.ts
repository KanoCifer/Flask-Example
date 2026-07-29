import {
  galleryGateway,
  type ExifInfo,
  type GalleryData,
  type GalleryImage,
  type SaveGalleryPayload,
} from '@readinglist/api';

// 照片墙服务 —— 委托给共享 @readinglist/api galleryGateway，保留工厂形态以兼容旧消费方

export type { ExifInfo, GalleryData, GalleryImage };
export type Picture = GalleryImage;

export interface GalleryService {
  getGallery(): Promise<GalleryData>;
  uploadGalleryImage(formData: FormData): Promise<string>;
  saveGallery(payload: SaveGalleryPayload): Promise<void>;
}

export const galleryService = (): GalleryService => ({
  async getGallery() {
    return galleryGateway.getGallery();
  },

  async uploadGalleryImage(formData: FormData) {
    return galleryGateway.uploadGalleryImage(formData);
  },

  async saveGallery(payload) {
    return galleryGateway.saveGallery(payload);
  },
});
