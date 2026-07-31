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
  /** 后端返回的原始 url,用于保存回传,避免 rewrite 后的展示值污染 DB。 */
  rawUrl?: string;
  description: string;
  exif?: ExifInfo | null;
  // 派生图与元数据(后端同步处理回填,可空)
  thumbnailUrl?: string;
  mediumUrl?: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
  fileSize?: number;
  mimeType?: string;
  status?: 'uploaded' | 'processing' | 'ready' | 'failed';
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

// ── 前端上传常量 —— 与后端 media.py MAX_IMAGE_BYTES / ALLOWED_IMAGE_TYPES 对齐 ──

export const PIC_MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB, with backend MAX_IMAGE_BYTES
export const PIC_ACCEPTED_MIME = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heif',
  'image/heic',
] as const;

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
    await apiClient.post('v2/publicv2/pic-gallery', payload);
  },
};
