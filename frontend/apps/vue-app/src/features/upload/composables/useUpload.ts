import { ref, type Ref } from 'vue';

import { uploadGateway } from '@/features/upload/api';
import type { UploadType } from '@/features/upload/api';

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
  isUploading: Ref<boolean>;
  /** 当前上传进度 (0-100)。 */
  progress: Ref<number>;
  /** 最近一次错误；成功时清零。 */
  error: Ref<Error | null>;
}

/**
 * 统一上传 composable —— 校验 → 上传 → 进度 → 结果。
 *
 * 纯上传原语：文件选择 / 预览 / 确认由各 feature 自身管理。
 * 校验集中可配（maxSize / allowedTypes），进度走 axios onUploadProgress。
 *
 * 用法:
 * ```ts
 * const { upload, isUploading, progress, error } = useUpload({
 *   type: 'gallery',
 *   maxSize: 5 * 1024 * 1024,
 *   allowedTypes: ['image/jpeg', 'image/png'],
 *   onProgress: (p) => console.log(p),
 * });
 * const url = await upload(file);
 * ```
 */
export function useUpload(options: UseUploadOptions): UseUploadReturn {
  const { type, maxSize, allowedTypes, onProgress } = options;

  const isUploading = ref(false);
  const progress = ref(0);
  const error = ref<Error | null>(null);

  const upload = async (file: File): Promise<string> => {
    // —— 校验 ——
    if (
      allowedTypes &&
      allowedTypes.length > 0 &&
      !allowedTypes.includes(file.type)
    ) {
      const err = new Error(`不支持的文件类型: ${file.type}`);
      error.value = err;
      throw err;
    }
    if (maxSize && file.size > maxSize) {
      const err = new Error(
        `文件超过大小限制: ${(maxSize / 1024 / 1024).toFixed(1)}MB`,
      );
      error.value = err;
      throw err;
    }

    // —— 上传 ——
    isUploading.value = true;
    progress.value = 0;
    error.value = null;

    try {
      const res = await uploadGateway.upload(file, type, {
        onProgress: (percent) => {
          progress.value = percent;
          onProgress?.(percent);
        },
      });
      return res.url;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      error.value = err;
      throw err;
    } finally {
      isUploading.value = false;
    }
  };

  return { upload, isUploading, progress, error };
}
