import { apiClient } from '../apiClient';
import type { AxiosProgressEvent } from 'axios';

// ── 上传网关（Vue / React 共享）──

/**
 * 上传类型 —— 决定后端存储路径与校验策略。
 *   - generic：通用文件，仅限大小，存 uploads/{userID}/
 *   - blog：博客图片，校验类型，存 posts/{userID}/
 *   - gallery：图片墙图片，校验类型，存 gallery/{userID}/
 *   - avatar：头像，校验类型 + 缩略图 + 回写 profile.photo，存 pics/{userID}/
 */
export type UploadType = 'generic' | 'blog' | 'gallery' | 'avatar';

export interface UploadConfig {
  /** 上传进度回调 (0-100)。 */
  onProgress?: (percent: number) => void;
}

/**
 * 统一上传网关 —— 所有图片 / 文件上传的唯一入口。
 *
 * generic/blog/gallery 走 POST/PUT v3/upload（FormData field: file + type）；
 * avatar 走 PUT v3/upload-pic（FormData field: image，后端做缩略图 + 回写）。
 */
export interface UploadGateway {
  upload(
    file: File,
    type: UploadType,
    config?: UploadConfig,
  ): Promise<{ url: string }>;
}

export const uploadGateway: UploadGateway = {
  async upload(
    file: File,
    type: UploadType,
    config?: UploadConfig,
  ): Promise<{ url: string }> {
    const onProgress = config?.onProgress;

    if (type === 'avatar') {
      const formData = new FormData();
      formData.append('image', file);
      const res = await apiClient.put<{ data: { url: string } }>(
        'v3/upload-pic',
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e: AxiosProgressEvent) => {
            if (e.total) onProgress?.(Math.round((e.loaded * 100) / e.total));
          },
        },
      );
      return res.data.data;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    const res = await apiClient.post<{ data: { url: string } }>(
      'v3/upload',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e: AxiosProgressEvent) => {
          if (e.total) onProgress?.(Math.round((e.loaded * 100) / e.total));
        },
      },
    );
    return res.data.data;
  },
};
