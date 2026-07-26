import imageCompression from 'browser-image-compression';

export interface CompressOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  onProgress?: (progress: number) => void;
}

const DEFAULT_OPTIONS: CompressOptions = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1920,
};

export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<File> {
  const mergedOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
    useWebWorker: true,
  };

  return imageCompression(file, mergedOptions);
}
