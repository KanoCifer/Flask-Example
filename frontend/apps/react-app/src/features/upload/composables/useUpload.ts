import { useCallback, useState } from 'react';

import { uploadGateway, type UploadType } from '@readinglist/api';

export interface UseUploadOptions {
  /** 上传类型 —— 决定后端存储路径与校验策略。 */
  type: UploadType;
  /** 最大允许字节数；超出时 reject。 */
  maxSize?: number;
  /** 允许的 MIME 类型；空表示不限。 */
  allowedTypes?: string[];
  /** 上传进度回调 (0-100)。 */
  onProgress?: (percent: number) => void;
}

export interface UseUploadReturn {
  /** 上传单个文件，成功返回服务端 URL。 */
  upload: (file: File) => Promise<string>;
  /** 是否正在上传。 */
  isUploading: boolean;
  /** 当前上传进度 (0-100)。 */
  progress: number;
  /** 最近一次错误；成功时清零。 */
  error: Error | null;
  /** 手动重置错误状态。 */
  resetError: () => void;
}

/**
 * 统一上传 hook —— 校验 → 上传 → 进度 → 结果。
 *
 * 与 Vue useUpload 同源：相同 maxSize / allowedTypes 校验，axios onUploadProgress。
 * 纯上传原语；文件选择 / 预览 / 确认由各 feature 自身管理。
 */
export function useUpload(options: UseUploadOptions): UseUploadReturn {
  const { type, maxSize, allowedTypes, onProgress } = options;

  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  const upload = useCallback(
    async (file: File): Promise<string> => {
      // —— 校验 ——
      if (
        allowedTypes &&
        allowedTypes.length > 0 &&
        !allowedTypes.includes(file.type)
      ) {
        const err = new Error(`不支持的文件类型: ${file.type}`);
        setError(err);
        throw err;
      }
      if (maxSize && file.size > maxSize) {
        const err = new Error(
          `文件超过大小限制: ${(maxSize / 1024 / 1024).toFixed(1)}MB`,
        );
        setError(err);
        throw err;
      }

      // —— 上传 ——
      setIsUploading(true);
      setProgress(0);
      setError(null);

      try {
        const res = await uploadGateway.upload(file, type, {
          onProgress: (percent) => {
            setProgress(percent);
            onProgress?.(percent);
          },
        });
        return res.url;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setIsUploading(false);
      }
    },
    [type, maxSize, allowedTypes, onProgress],
  );

  const resetError = useCallback(() => setError(null), []);

  return { upload, isUploading, progress, error, resetError };
}
