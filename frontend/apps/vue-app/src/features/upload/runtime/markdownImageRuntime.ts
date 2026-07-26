import { ref, type Ref } from 'vue';

export type ImageAlign = 'left' | 'center' | 'right';

export interface MarkdownImageEditorDeps {
  /** 上传单张图片,返回服务端 URL。 */
  uploadImage: (file: File) => Promise<{ url: string }>;
}

/**
 * Markdown 图像编辑器运行时(ADR-0002 模板)。
 *
 * 持有 markdown 文档中所有图像的状态(blob URL 映射、编辑器表单字段)
 * 与处理逻辑(add / replace / publish / dispose)。不依赖 Vue 组件,
 * 可在测试中直接实例化(refs 在构造时自动创建,可通过 `.value` 读写)。
 *
 * Vue facade (`useMarkdownImage`) 负责 `onBeforeUnmount` 触发 `dispose()`,
 * 把 refs 透传给组件模板。
 */
export class MarkdownImageEditor {
  // Blob URL → 原 File 映射;`getContentForPublish` 时批量上传。
  readonly blobFileMap: Ref<Map<string, File>>;
  // 隐藏文件 input 的 DOM ref,由组件模板 `:ref="bindFileInputRef"` 注入。
  readonly fileInputRef: Ref<HTMLInputElement | null>;
  // 编辑器模态显示开关。
  readonly isImageEditorOpen: Ref<boolean>;
  // 编辑器表单字段。
  readonly editingImageUrl: Ref<string>;
  readonly editingImageAlt: Ref<string>;
  readonly editingImageTitle: Ref<string>;
  readonly editingImageWidth: Ref<string>;
  readonly editingImageHeight: Ref<string>;
  readonly editingImageAlign: Ref<ImageAlign>;
  readonly editingImageFile: Ref<File | null>;

  private readonly uploadImage: (file: File) => Promise<{ url: string }>;

  constructor(deps: MarkdownImageEditorDeps) {
    this.blobFileMap = ref(new Map());
    this.fileInputRef = ref<HTMLInputElement | null>(null);
    this.isImageEditorOpen = ref(false);
    this.editingImageUrl = ref('');
    this.editingImageAlt = ref('');
    this.editingImageTitle = ref('');
    this.editingImageWidth = ref('');
    this.editingImageHeight = ref('');
    this.editingImageAlign = ref<ImageAlign>('center');
    this.editingImageFile = ref<File | null>(null);

    this.uploadImage = deps.uploadImage;
  }

  /** 创建 blob URL,登记到 map,返回可直接插入 markdown 的片段。 */
  addImageFile(file: File): string {
    const blobUrl = URL.createObjectURL(file);
    this.blobFileMap.value.set(blobUrl, file);
    return `![image](${blobUrl})`;
  }

  /** 工具栏上传 input → 返回 markdown 片段或 null。 */
  handleImageUpload(event: Event): string | null {
    const target = event.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return null;
    const file = target.files[0];
    const md = this.addImageFile(file);
    target.value = '';
    return md;
  }

  /** 拖拽释放 → 返回 markdown 片段列表(非图片忽略)。 */
  handleDrop(event: DragEvent): string[] {
    const results: string[] = [];
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return results;
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      results.push(this.addImageFile(file));
    }
    return results;
  }

  /** 剪贴板粘贴 → 返回 markdown 片段列表。 */
  handlePaste(event: ClipboardEvent): string[] {
    const results: string[] = [];
    const items = event.clipboardData?.items;
    if (!items) return results;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          results.push(this.addImageFile(file));
        }
      }
    }
    return results;
  }

  /** 点击 markdown 中的图片 → 打开编辑器并预填字段。 */
  openImageEditor(img: HTMLImageElement): void {
    this.editingImageUrl.value = img.currentSrc || img.src;
    this.editingImageAlt.value = img.alt || '';
    this.editingImageTitle.value = img.getAttribute('title') || '';
    this.editingImageWidth.value = img.getAttribute('width') || '';
    this.editingImageHeight.value = img.getAttribute('height') || '';
    this.editingImageAlign.value = 'center';
    this.editingImageFile.value = null;
    this.isImageEditorOpen.value = true;
  }

  /** 关闭编辑器并清空所有字段。 */
  closeImageEditor(): void {
    this.isImageEditorOpen.value = false;
    this.editingImageUrl.value = '';
    this.editingImageAlt.value = '';
    this.editingImageTitle.value = '';
    this.editingImageWidth.value = '';
    this.editingImageHeight.value = '';
    this.editingImageAlign.value = 'center';
    this.editingImageFile.value = null;
  }

  /** 编辑器内"替换图片"上传 → 用新 blob URL 替换 url 字段。 */
  handleReplaceImageUpload(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;
    const file = target.files[0];
    const newBlobUrl = URL.createObjectURL(file);
    this.blobFileMap.value.set(newBlobUrl, file);
    this.editingImageUrl.value = newBlobUrl;
    this.editingImageFile.value = file;
    if (!this.editingImageAlt.value) {
      this.editingImageAlt.value = file.name;
    }
    target.value = '';
  }

  /** 在新标签页打开图片。 */
  openImageInNewTab(url: string): void {
    window.open(url);
  }

  /**
   * 上传所有 blob 图片到服务器,并把 markdown 中的 blob URL 替换为服务端 URL。
   * 返回处理后的 markdown 字符串。
   */
  async getContentForPublish(content: string): Promise<string> {
    const entries = [...this.blobFileMap.value.entries()];
    const results = await Promise.all(
      entries.map(async ([blobUrl, file]) => {
        const response = await this.uploadImage(file);
        URL.revokeObjectURL(blobUrl);
        return { blobUrl, serverUrl: response.url };
      }),
    );

    let result = content;
    for (const { blobUrl, serverUrl } of results) {
      result = result.replaceAll(blobUrl, serverUrl);
    }
    this.blobFileMap.value.clear();
    return result;
  }

  /** 释放所有 blob URL,清空 map。组件卸载时由 facade 调用。 */
  dispose(): void {
    for (const blobUrl of this.blobFileMap.value.keys()) {
      URL.revokeObjectURL(blobUrl);
    }
    this.blobFileMap.value.clear();
  }
}
