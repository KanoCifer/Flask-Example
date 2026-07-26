import { useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { UploadCloud } from 'lucide-react';

interface UploadDropzoneProps {
  /** 原生 <input type="file"> 的 accept 字符串（如 "image/*"）。 */
  accept?: string;
  /** 是否多选。 */
  multiple?: boolean;
  /** 禁用态：禁用点击与拖拽，灰化样式。 */
  disabled?: boolean;
  /** 主提示文案（第一行）。 */
  prompt?: string;
  /** 辅助说明（第二行，灰色小字）。 */
  hint?: string;
  /** 用户完成一次选择（点击或拖拽），附带 File 数组。 */
  onSelect: (files: File[]) => void;
}

/**
 * UploadDropzone —— 通用文件拖拽 / 点击选择区域（React 版，对齐 Vue UploadDropzone）。
 *
 * - 点击或拖拽到此处都会触发文件选择。
 * - dragover 时高亮边框 / 背景作为视觉反馈。
 * - 选择完成后调用 `onSelect`，把 File 数组交给上层处理（上传 / 预览）。
 */
export function UploadDropzone({
  accept,
  multiple,
  disabled,
  prompt = '点击或拖拽文件到此处',
  hint = '支持单文件上传',
  onSelect,
}: UploadDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // 计数器避免子元素触发的 dragleave 误判为"已离开 dropzone"。
  // 用 useRef 保活，避免 setIsDragging(true) 触发的重渲染把计数器清零。
  const dragCounterRef = useRef(0);

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleClick = () => {
    if (disabled) return;
    triggerFileInput();
  };

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const target = event.target;
    if (!target.files || target.files.length === 0) return;
    onSelect(Array.from(target.files));
    // 清空 input，允许重复选择同一文件。
    target.value = '';
  };

  const onDragEnter = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    dragCounterRef.current += 1;
    setIsDragging(true);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
  };

  const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setIsDragging(false);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    onSelect(Array.from(files));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      triggerFileInput();
    }
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      className={[
        'group bg-surface/40 text-ink hover:border-muted-foreground hover:bg-surface relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all select-none',
        isDragging ? 'border-ink bg-surface scale-[0.99]' : '',
        disabled ? 'cursor-not-allowed opacity-60' : '',
      ].join(' ')}
      onClick={handleClick}
      onKeyDown={onKeyDown}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={onInputChange}
      />
      <div className="bg-page ring-border/5 mb-4 flex h-12 w-12 items-center justify-center rounded-full shadow-sm ring-1 transition-transform group-hover:scale-110">
        <UploadCloud
          className="text-muted group-hover:text-ink h-5 w-5 transition-colors"
          strokeWidth={1.5}
        />
      </div>
      <p className="text-ink text-sm font-medium">{prompt}</p>
      {hint && <p className="text-muted mt-2 text-xs">{hint}</p>}
    </div>
  );
}
