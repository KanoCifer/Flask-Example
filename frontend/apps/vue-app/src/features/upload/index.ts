// upload 域入口（deep module public surface）

export { uploadGateway } from '@readinglist/api';
export type { UploadGateway, UploadType, UploadConfig } from '@readinglist/api';

export { useUpload } from './composables/useUpload';
export type {
  UseUploadOptions,
  UseUploadReturn,
} from './composables/useUpload';

export { useMarkdownImage } from './composables/useMarkdownImage';

export { MarkdownImageEditor } from './runtime/markdownImageRuntime';
export type {
  MarkdownImageEditorDeps,
  ImageAlign,
} from './runtime/markdownImageRuntime';

export { UploadDropzone, UploadProgress, CoverUploader } from './components';
