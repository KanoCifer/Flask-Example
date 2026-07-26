import { getFileExtension, processImage } from '../lib/image';
import { computed, onUnmounted, ref } from 'vue';

interface OutputTypeOption {
  label: string;
  value: string;
}

function getOutputExtension(mimeType: string) {
  switch (mimeType) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    default:
      return '.img';
  }
}

export function useImageProcessor() {
  const fileInputRef = ref<HTMLInputElement | null>(null);

  const originalFile = ref<File | null>(null);
  const processedBlob = ref<Blob | null>(null);
  const originalPreviewUrl = ref<string>('');
  const processedPreviewUrl = ref<string>('');
  const originalPreviewZoom = ref<number>(1);
  const processedPreviewZoom = ref<number>(1);
  const processing = ref<boolean>(false);
  const errorMessage = ref<string>('');
  const customFileName = ref<string>('');

  const maxWidth = ref<number>(1600);
  const enableMaxWidth = ref<boolean>(false);
  const quality = ref<number>(0.8);
  const outputType = ref<string>('image/webp');
  const outputTypes: readonly OutputTypeOption[] = [
    { label: 'WebP', value: 'image/webp' },
    { label: 'JPEG', value: 'image/jpeg' },
    { label: 'PNG', value: 'image/png' },
  ] as const;

  // Slider 组件 v-model 需要数组格式，这里做个转换
  const qualityArray = computed({
    get: () => [quality.value],
    set: (val: number[]) => {
      quality.value = val[0];
    },
  });

  const compressionRatio = computed(() => {
    if (!originalFile.value || !processedBlob.value) {
      return '-';
    }
    const ratio =
      ((originalFile.value.size - processedBlob.value.size) /
        originalFile.value.size) *
      100;
    return `${ratio.toFixed(1)}%`;
  });

  function revokePreviewUrl(url: string) {
    if (!url) {
      return;
    }
    URL.revokeObjectURL(url);
  }

  function resetProcessedState() {
    revokePreviewUrl(processedPreviewUrl.value);
    processedPreviewUrl.value = '';
    processedBlob.value = null;
    processedPreviewZoom.value = 1;
  }

  // 弹层预览控制之外的所有"原始/处理后"状态都由这里管理
  function selectFile(selectedFile: File) {
    errorMessage.value = '';

    if (!selectedFile.type.startsWith('image/')) {
      errorMessage.value = '请选择有效的图片文件。';
      return;
    }

    originalFile.value = selectedFile;
    resetProcessedState();
    originalPreviewZoom.value = 1;
    // 预填导出文件名为原文件主名，用户可继续修改；留空时下载会回退到原名
    customFileName.value = selectedFile.name.replace(
      getFileExtension(selectedFile.name),
      '',
    );

    // 释放之前的预览 URL，避免内存泄漏
    revokePreviewUrl(originalPreviewUrl.value);
    originalPreviewUrl.value = URL.createObjectURL(selectedFile);
  }

  function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const selectedFile = input.files?.[0];
    if (!selectedFile) {
      return;
    }
    selectFile(selectedFile);
  }

  async function process() {
    if (!originalFile.value) {
      errorMessage.value = '请先选择图片文件。';
      return;
    }

    errorMessage.value = '';
    processing.value = true;

    try {
      const normalizedQuality = Math.min(Math.max(quality.value, 0.3), 1);
      const resultBlob = await processImage(originalFile.value, {
        maxWidth: enableMaxWidth.value ? maxWidth.value : undefined,
        quality: normalizedQuality,
        type: outputType.value,
      });

      resetProcessedState();
      processedBlob.value = resultBlob;
      processedPreviewUrl.value = URL.createObjectURL(resultBlob);
    } catch (error: unknown) {
      if (error instanceof Error) {
        errorMessage.value = error.message;
      } else {
        errorMessage.value = '图片处理失败，请稍后重试。';
      }
    } finally {
      processing.value = false;
    }
  }

  function download() {
    if (!processedBlob.value || !originalFile.value) {
      return;
    }

    const originalExtension = getFileExtension(originalFile.value.name);
    const outputExtension = getOutputExtension(outputType.value);
    const defaultBaseName = originalFile.value.name.replace(
      originalExtension,
      '',
    );
    // 留空或全空白时回退到原文件主名，保证总能生成一个有效的下载名
    const baseName = customFileName.value.trim() || defaultBaseName;
    const downloadName = `${baseName}${outputExtension}`;
    const url = URL.createObjectURL(processedBlob.value);

    const link = document.createElement('a');
    link.href = url;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 0);
  }

  function triggerFilePicker() {
    fileInputRef.value?.click();
  }

  function resetAll() {
    errorMessage.value = '';
    processing.value = false;

    originalFile.value = null;
    resetProcessedState();

    revokePreviewUrl(originalPreviewUrl.value);
    originalPreviewUrl.value = '';
    originalPreviewZoom.value = 1;

    maxWidth.value = 1600;
    enableMaxWidth.value = true;
    quality.value = 0.8;
    outputType.value = 'image/webp';
    customFileName.value = '';

    if (fileInputRef.value) {
      fileInputRef.value.value = '';
    }
  }

  // 组件卸载前清理对象 URL，避免内存泄漏
  onUnmounted(() => {
    revokePreviewUrl(originalPreviewUrl.value);
    revokePreviewUrl(processedPreviewUrl.value);
  });

  return {
    // state
    fileInputRef,
    originalFile,
    processedBlob,
    originalPreviewUrl,
    processedPreviewUrl,
    originalPreviewZoom,
    processedPreviewZoom,
    processing,
    errorMessage,
    customFileName,
    maxWidth,
    enableMaxWidth,
    quality,
    qualityArray,
    outputType,
    outputTypes,
    compressionRatio,
    // actions
    handleFileChange,
    selectFile,
    process,
    download,
    triggerFilePicker,
    resetAll,
  };
}
