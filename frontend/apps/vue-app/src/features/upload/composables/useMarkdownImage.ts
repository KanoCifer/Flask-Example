import { onBeforeUnmount } from 'vue';
import { uploadGateway } from '@/features/upload/api';
import { MarkdownImageEditor } from '../runtime/markdownImageRuntime';

/**
 * Markdown 图像编辑器的 Vue 入口(ADR-0002 facade 模板)。
 *
 * 行为委托给 `MarkdownImageEditor` runtime;fascade 仅负责:
 * - 把 runtime refs 透传给组件模板
 * - 在组件卸载时调用 `dispose()` 释放 blob URL
 *
 * 隐藏 runtime 内部状态(`blobFileMap`、`addImageFile` 不外泄)。
 *
 * 用法:
 * ```vue
 * <script setup>
 * const image = useMarkdownImage();
 * </script>
 * <template>
 *   <input ref="image.fileInputRef" type="file" hidden />
 * </template>
 * ```
 */
export function useMarkdownImage() {
  const editor = new MarkdownImageEditor({
    uploadImage: (file: File) => uploadGateway.upload(file, 'blog'),
  });

  onBeforeUnmount(() => {
    editor.dispose();
  });

  return {
    // 透传 runtime refs(模板需要的最小集)
    fileInputRef: editor.fileInputRef,
    isImageEditorOpen: editor.isImageEditorOpen,
    editingImageUrl: editor.editingImageUrl,
    editingImageAlt: editor.editingImageAlt,
    editingImageTitle: editor.editingImageTitle,
    editingImageWidth: editor.editingImageWidth,
    editingImageHeight: editor.editingImageHeight,
    editingImageAlign: editor.editingImageAlign,
    editingImageFile: editor.editingImageFile,
    // 透传 handlers(参数签名与原 composable 完全一致)
    handleImageUpload: (event: Event) => editor.handleImageUpload(event),
    handleDrop: (event: DragEvent) => editor.handleDrop(event),
    handlePaste: (event: ClipboardEvent) => editor.handlePaste(event),
    openImageEditor: (img: HTMLImageElement) => editor.openImageEditor(img),
    closeImageEditor: () => editor.closeImageEditor(),
    handleReplaceImageUpload: (event: Event) =>
      editor.handleReplaceImageUpload(event),
    openImageInNewTab: (url: string) => editor.openImageInNewTab(url),
    getContentForPublish: (content: string) =>
      editor.getContentForPublish(content),
  };
}
