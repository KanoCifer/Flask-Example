interface ProcessImageOptions {
  maxWidth?: number;
  quality?: number; // 0.3 to 1
  type?: string; // e.g., "image/webp"
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes.toFixed(0)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function getFileExtension(name: string) {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx) : '';
}

async function processImage(file: File, options: ProcessImageOptions) {
  // 创建 ImageBitmap 对象
  const bitmap = await createImageBitmap(file);
  const { maxWidth, quality = 0.8, type = 'image/webp' } = options; // 默认质量为 0.8，默认类型为 "image/webp"
  let { width, height } = bitmap;
  // 改变宽度，保持宽高比
  if (maxWidth && maxWidth < width) {
    const ratio = maxWidth / width;
    width = maxWidth;
    height = Math.round(height * ratio);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('无法获取 Canvas 上下文');
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error('无法生成输出文件'));
      },
      type,
      quality,
    );
  });
  return blob;
}

export { formatBytes, getFileExtension, processImage };
