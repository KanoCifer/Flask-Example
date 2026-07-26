import apiClient, { extractData } from '@/api/apiClient';
import type { AxiosProgressEvent } from 'axios';

/**
 * 上传类型 —— 决定后端存储路径与校验策略。
 *   - generic：通用文件，仅限大小，存 uploads/{userID}/
 *   - blog：博客图片，校验类型，存 posts/{userID}/
 *   - gallery：图片墙图片，校验类型，存 gallery/{userID}/
 */
export type UploadType = 'generic' | 'blog' | 'gallery' | 'avatar';

export interface UploadConfig {
  /** 上传进度回调 (0-100)。 */
  onProgress?: (percent: number) => void;
}

/**
 * 统一上传网关 —— 所有图片 / 文件上传的唯一入口。
 *
 * 与 Vue 端对齐：avatar 走 PUT v3/upload-pic，其它走 POST v3/upload。
 */
export interface UploadGateway {
  upload(
    file: File,
    type: UploadType,
    config?: UploadConfig,
  ): Promise<{ url: string }>;
}

export const uploadGateway: UploadGateway = {
  async upload(file, type, config) {
    const onProgress = config?.onProgress;

    if (type === 'avatar') {
      const formData = new FormData();
      formData.append('image', file);
      const res = await apiClient.put('v3/upload-pic', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e: AxiosProgressEvent) => {
          if (e.total) onProgress?.(Math.round((e.loaded * 100) / e.total));
        },
      });
      return extractData(res) as { url: string };
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    const res = await apiClient.post('v3/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e: AxiosProgressEvent) => {
        if (e.total) onProgress?.(Math.round((e.loaded * 100) / e.total));
      },
    });
    return extractData(res) as { url: string };
  },
};
