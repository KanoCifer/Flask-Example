// 照片墙（Pic / Gallery）领域类型

import type { ExifInfo } from '@/features/pic/composables';

export interface GalleryImage {
  id: string;
  url: string;
  description: string;
  uploadedAt?: string;
  exif?: ExifInfo | null;
}

export interface GalleryResponse {
  images: GalleryImage[];
}
