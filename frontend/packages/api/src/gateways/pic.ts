import { apiClient, extractData } from '../apiClient';

// ── 照片墙领域类型 —— 框架无关，两端（Vue useGallery / React galleryService）结构一致 ──

export interface ExifInfo {
  camera?: string;
  lens?: string;
  iso?: number;
  exposure?: string;
  aperture?: string;
  focalLength?: string;
  focalLength35?: string;
  takenAt?: string;
  gps?: { lat: number; lng: number };
}

export interface GalleryImage {
  id: string;
  uploadedAt?: string;
  url: string;
  description: string;
  exif?: ExifInfo | null;
}

export interface GalleryData {
  images: GalleryImage[];
}

export interface SaveGalleryPayload {
  images: Array<{
    id: string;
    url: string;
    description: string;
    uploadedAt?: string;
  }>;
}

// ── 照片墙网关 —— 对齐 React galleryService（返回解包后的领域数据）──

export interface GalleryGateway {
  getGallery(): Promise<GalleryData>;
  uploadGalleryImage(formData: FormData): Promise<string>;
  saveGallery(payload: SaveGalleryPayload): Promise<void>;
}

export const galleryGateway: GalleryGateway = {
  async getGallery(): Promise<GalleryData> {
    const res = await apiClient.get('v2/publicv2/pic-gallery');
    const data = extractData(res) as { images?: GalleryImage[] } | undefined;
    return {
      images: data?.images ?? [],
    };
  },

  async uploadGalleryImage(formData: FormData): Promise<string> {
    const res = await apiClient.post('v3/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const data = extractData(res) as { url?: string } | undefined;
    if (!data?.url) {
      throw new Error('上传成功但未返回图片地址');
    }
    return data.url;
  },

  async saveGallery(payload: SaveGalleryPayload): Promise<void> {
    await apiClient.post('v2/publicv2/set-pic-gallery', payload);
  },
};
