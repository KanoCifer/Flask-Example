import type {
  Moment,
  MomentAttachment,
  MomentStatus,
  MomentUpdatePayload,
  MomentVisibility,
} from '@/types';
import { AnimatePresence, motion } from 'framer-motion';
import { ImageOff, ImagePlus, Loader2, RefreshCw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useUpload } from '@/features/upload';
import { UploadDropzone, UploadProgress } from '@/features/upload';
import { IconClose } from './InlineIcons';

const EMOJI_PRESETS = [
  '🌿',
  '☕',
  '🌧',
  '📖',
  '🐟',
  '🌙',
  '☀',
  '🍃',
  '🎣',
  '✏',
  '💭',
  '🪴',
] as const;

const VIS_OPTIONS: { value: MomentVisibility; label: string; desc: string }[] =
  [
    { value: 'public', label: '公开', desc: '任何访客可见' },
    { value: 'unlisted', label: '不列出', desc: '链接可访问，但不在列表' },
    { value: 'private', label: '不公开', desc: '仅自己' },
  ];

export interface MomentEditorModalProps {
  open: boolean;
  moment: Moment | null;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: MomentUpdatePayload) => void;
}

export function MomentEditorModal({
  open,
  moment,
  submitting = false,
  onClose,
  onSubmit,
}: MomentEditorModalProps) {
  const isEdit = !!moment;
  const [content, setContent] = useState('');
  const [mood, setMood] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [visibility, setVisibility] = useState<MomentVisibility>('public');
  const [status, setStatus] = useState<MomentStatus>('published');
  const [isPinned, setIsPinned] = useState(false);
  const [allowComment, setAllowComment] = useState(true);

  // ── 附件(图片) ──
  // 复用 React 端 useUpload(type='gallery')，与 Vue 端同源。
  const MAX_ATTACHMENTS = 9;
  const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
  const ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ];

  const [attachments, setAttachments] = useState<MomentAttachment[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const attachmentFileInputRef = useRef<HTMLInputElement | null>(null);

  const { upload, isUploading, progress } = useUpload({
    type: 'gallery',
    maxSize: MAX_UPLOAD_BYTES,
    allowedTypes: ALLOWED_IMAGE_TYPES,
  });

  const canAddMore =
    attachments.length < MAX_ATTACHMENTS && !previewUrl && !isUploading;

  // 同步 moment → 表单(包括 attachments)。
  useEffect(() => {
    if (open) {
      if (moment) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setContent(moment.content);
        setMood(moment.mood ?? '');
        setTags([...moment.tags]);
        setVisibility(moment.visibility);
        setStatus(moment.status);
        setIsPinned(moment.is_pinned);
        setAllowComment(moment.allow_comment);
        setAttachments(moment.attachments.filter((a) => a.type === 'image'));
      } else {
        setContent('');
        setMood('');
        setTags([]);
        setTagInput('');
        setVisibility('public');
        setStatus('published');
        setIsPinned(false);
        setAllowComment(true);
        setAttachments([]);
      }
      setSelectedFile(null);
      setPreviewUrl(null);
      setPendingError(null);
    }
  }, [open, moment]);

  // 释放旧预览 object URL，避免内存泄漏。
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  // 选中文件后立刻触发 upload(串行)。
  useEffect(() => {
    if (!selectedFile) return;
    let cancelled = false;
    runUpload(selectedFile, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [selectedFile, upload]);

  /**
   * 选中文件后立刻触发 upload(串行)。
   * 与 retryUpload 共用一条上传链 — 失败保留 preview，可重试。
   * `isCancelled` 用于丢弃过期闭包的结果：组件卸载或 selectedFile 被替换时不写入 state。
   */
  async function runUpload(
    file: File,
    isCancelled?: () => boolean,
  ): Promise<void> {
    setPendingError(null);
    try {
      const url = await upload(file);
      if (isCancelled?.()) return;
      setAttachments((prev) => [...prev, { type: 'image', url }]);
      setSelectedFile(null);
      setPreviewUrl(null);
    } catch {
      if (isCancelled?.()) return;
      setPendingError('图片上传失败，请重试');
    }
  }

  function handleDropzoneSelect(files: File[]) {
    const f = files[0];
    if (f) startUpload(f);
  }

  function startUpload(file: File) {
    if (!canAddMore) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function removeAttachment(idx: number) {
    // 编辑模式：对已存在的服务器附件删除走 confirm，避免误删。
    if (isEdit && !window.confirm('确定删除这张图片吗？')) {
      return;
    }
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  async function retryUpload(): Promise<void> {
    if (!selectedFile || isUploading) return;
    await runUpload(selectedFile);
  }

  function removeFailed(): void {
    setSelectedFile(null);
    setPreviewUrl(null);
    setPendingError(null);
  }

  function onAttachmentInput(event: React.ChangeEvent<HTMLInputElement>) {
    const target = event.target;
    const f = target.files?.[0];
    if (f) startUpload(f);
    // 重置 input value，使再次选择同一文件能触发 change。
    target.value = '';
  }

  function triggerAttachmentPicker(): void {
    attachmentFileInputRef.current?.click();
  }

  function toggleMood(emoji: string) {
    setMood((cur) => (cur === emoji ? '' : emoji));
  }

  function addTag() {
    const v = tagInput.trim().slice(0, 50);
    if (!v) return;
    if (tags.includes(v)) {
      setTagInput('');
      return;
    }
    if (tags.length >= 20) return;
    setTags([...tags, v]);
    setTagInput('');
  }

  function removeTag(idx: number) {
    setTags(tags.filter((_, i) => i !== idx));
  }

  function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || trimmed.length > 2000) return;
    // 上传未完成时禁止提交，避免丢失未持久化的附件。
    if (isUploading) return;
    onSubmit({
      content: trimmed,
      mood: mood || null,
      tags,
      visibility,
      status,
      is_pinned: isPinned,
      allow_comment: allowComment,
      attachments,
    });
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="bg-page/60 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 4 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-page /40 relative flex max-h-[88vh] w-full max-w-[760px] flex-col overflow-hidden rounded-xl border shadow-xl"
          >
            {/* Header */}
            <div className="/40 bg-page sticky top-0 z-10 flex items-center justify-between gap-2 border-b px-6 py-4">
              <div>
                <div className="text-muted font-mono text-[10px] tracking-[0.18em] uppercase">
                  {isEdit ? 'EDIT · 编辑' : 'NEW · 写一句'}
                </div>
                <h2 className="text-ink font-serif text-lg font-medium italic">
                  {isEdit ? '改一改' : '碎碎念'}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-muted hover:text-ink /40 inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors"
                aria-label="关闭"
              >
                <IconClose className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Body */}
            <div className="grid max-h-[calc(88vh-72px)] grid-cols-1 gap-0 overflow-hidden md:grid-cols-[minmax(0,1fr)_220px]">
              <form
                className="space-y-5 overflow-y-auto px-7 py-6"
                onSubmit={handleSubmit}
              >
                {/* Content */}
                <div>
                  <div className="mb-1.5 flex items-baseline gap-2">
                    <label
                      htmlFor="moment-content"
                      className="text-ink font-serif text-sm font-medium"
                    >
                      内容
                    </label>
                    <span className="text-warning text-[11px]">*</span>
                    <span className="text-muted text-[11px]">
                      必填 · 1~2000 字 · 支持 Markdown
                    </span>
                  </div>
                  <textarea
                    id="moment-content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={8}
                    maxLength={2000}
                    placeholder="今天想到什么..."
                    className="bg-page border-input text-ink placeholder:text-muted/60 focus:border-accent focus:ring-ring/20 min-h-[180px] w-full resize-y rounded-lg border px-4 py-3 font-serif text-[15px] leading-loose focus:ring-2 focus:outline-none"
                  />
                  <div className="text-muted mt-1.5 flex items-center justify-between font-mono text-[10px] tracking-wide">
                    <span>&nbsp;</span>
                    <span
                      className={
                        content.length > 2000 ? 'text-destructive' : ''
                      }
                    >
                      {content.length} / 2000
                    </span>
                  </div>
                </div>

                {/* Attachments (image) */}
                <div>
                  <div className="mb-1.5 flex items-baseline gap-2">
                    <span className="text-ink font-serif text-sm font-medium">
                      附件
                    </span>
                    <span className="text-muted text-[11px]">
                      图片 · 最多 {MAX_ATTACHMENTS} 张 · 单张 ≤5MB
                    </span>
                    <span className="text-muted ml-auto font-mono text-[10px] tabular-nums">
                      {attachments.length} / {MAX_ATTACHMENTS}
                    </span>
                  </div>

                  {/* Empty state: UploadDropzone */}
                  {attachments.length === 0 && !previewUrl && (
                    <UploadDropzone
                      accept="image/*"
                      disabled={isUploading}
                      prompt="点击或拖拽图片到此处"
                      hint={`最多 ${MAX_ATTACHMENTS} 张，单张 ≤5MB`}
                      onSelect={handleDropzoneSelect}
                    />
                  )}

                  {/* Non-empty: 3-col grid */}
                  {!(attachments.length === 0 && !previewUrl) && (
                    <div className="grid grid-cols-3 gap-2">
                      {attachments.map((att, idx) => (
                        <div
                          key={att.url}
                          className="group bg-surface relative aspect-square overflow-hidden rounded-xl"
                        >
                          <img
                            src={att.url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            className="bg-page/80 text-ink hover:bg-page absolute top-1.5 right-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full opacity-0 shadow-sm backdrop-blur-md transition-opacity group-hover:opacity-100"
                            aria-label={`删除图片 ${idx + 1}`}
                            onClick={() => removeAttachment(idx)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}

                      {/* Uploading / failed tile */}
                      {previewUrl && (
                        <div
                          className={[
                            'bg-surface relative aspect-square overflow-hidden rounded-xl',
                            pendingError ? '' : 'opacity-60',
                          ].join(' ')}
                          aria-busy="true"
                        >
                          <img
                            src={previewUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                          {!pendingError && (
                            <>
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <Loader2 className="h-5 w-5 animate-spin text-white" />
                              </div>
                              <div className="absolute right-2 bottom-2 left-2">
                                <UploadProgress
                                  progress={progress}
                                  height="h-1"
                                />
                              </div>
                            </>
                          )}
                          {pendingError && (
                            <div className="border-destructive bg-page/95 absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-2 text-center backdrop-blur-md">
                              <ImageOff className="text-destructive h-5 w-5" />
                              <p className="text-destructive text-xs leading-tight font-medium">
                                {pendingError}
                              </p>
                              <div className="flex gap-1.5">
                                <button
                                  type="button"
                                  className="bg-accent text-ink hover:bg-accent/90 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium"
                                  onClick={retryUpload}
                                >
                                  <RefreshCw className="h-3 w-3" />
                                  重试
                                </button>
                                <button
                                  type="button"
                                  className="bg-surface text-ink hover:bg-surface/70 rounded-md px-2 py-1 text-xs font-medium"
                                  onClick={removeFailed}
                                >
                                  移除
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* + tile */}
                      {canAddMore && (
                        <button
                          type="button"
                          className="bg-surface hover:bg-surface/70 relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors"
                          aria-label="添加图片"
                          title={`还可上传 ${MAX_ATTACHMENTS - attachments.length} 张`}
                          onClick={triggerAttachmentPicker}
                        >
                          <ImagePlus
                            className="text-muted h-5 w-5"
                            strokeWidth={1.5}
                          />
                          <span className="text-muted mt-1 text-xs">添加</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Hidden file input for + tile */}
                  <input
                    ref={attachmentFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onAttachmentInput}
                  />
                </div>

                {/* Mood */}
                <div>
                  <div className="mb-1.5 flex items-baseline gap-2">
                    <label className="text-ink font-serif text-sm font-medium">
                      心情
                    </label>
                    <span className="text-muted text-[11px]">
                      emoji 或一个词
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {EMOJI_PRESETS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => toggleMood(e)}
                        className={[
                          'flex h-8 w-8 items-center justify-center rounded-lg border text-[16px] transition-colors',
                          mood === e
                            ? 'border-accent bg-accent/10'
                            : '/40 bg-page hover:bg-surface',
                        ].join(' ')}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                  <input
                    value={mood}
                    onChange={(e) => setMood(e.target.value)}
                    type="text"
                    maxLength={50}
                    placeholder="或自定义心情..."
                    className="bg-page border-input text-ink placeholder:text-muted/60 focus:border-accent focus:ring-ring/20 mt-2 w-full rounded-lg border px-3 py-1.5 text-[13px] focus:ring-2 focus:outline-none"
                  />
                </div>

                {/* Tags */}
                <div>
                  <div className="mb-1.5 flex items-baseline gap-2">
                    <label className="text-ink font-serif text-sm font-medium">
                      标签
                    </label>
                    <span className="text-muted text-[11px]">
                      回车添加，× 删除 · ≤20
                    </span>
                  </div>
                  <div className="bg-page border-input flex flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5">
                    {tags.map((tag, i) => (
                      <span
                        key={tag + i}
                        className="bg-surface text-ink inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px]"
                      >
                        <span className="text-ink/70 font-serif">#</span>
                        {tag}
                        <button
                          type="button"
                          className="text-muted hover:text-ink"
                          aria-label={`删除标签 ${tag}`}
                          onClick={() => removeTag(i)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      type="text"
                      maxLength={50}
                      placeholder="新标签..."
                      className="text-ink min-w-[80px] flex-1 bg-transparent px-1 text-[12px] outline-none"
                    />
                  </div>
                </div>
              </form>

              {/* Right: settings */}
              <aside className="bg-surface/30 /40 space-y-4 overflow-y-auto border-t px-5 py-6 md:border-t-0 md:border-l">
                <div>
                  <div className="text-muted mb-2 font-mono text-[10px] tracking-[0.15em] uppercase">
                    可见性
                  </div>
                  <div className="space-y-1.5">
                    {VIS_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className={[
                          'flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2',
                          visibility === opt.value
                            ? 'border-accent bg-accent/5'
                            : '/40 bg-page hover:bg-surface',
                        ].join(' ')}
                      >
                        <input
                          type="radio"
                          name="vis"
                          value={opt.value}
                          checked={visibility === opt.value}
                          onChange={() => setVisibility(opt.value)}
                          className="mt-1"
                        />
                        <div>
                          <div className="text-ink text-[12px] font-medium">
                            {opt.label}
                          </div>
                          <div className="text-muted mt-0.5 text-[11px]">
                            {opt.desc}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-muted mb-2 font-mono text-[10px] tracking-[0.15em] uppercase">
                    状态
                  </div>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as MomentStatus)}
                    className="bg-page border-input text-ink w-full rounded-lg border px-2.5 py-1.5 text-[13px]"
                  >
                    <option value="published">已发布</option>
                    <option value="draft">草稿</option>
                    <option value="archived">归档</option>
                  </select>
                </div>

                <div>
                  <div className="text-muted mb-2 font-mono text-[10px] tracking-[0.15em] uppercase">
                    选项
                  </div>
                  <label className="text-ink mb-1.5 flex items-center gap-2 text-[12px]">
                    <input
                      type="checkbox"
                      checked={isPinned}
                      onChange={(e) => setIsPinned(e.target.checked)}
                    />
                    置顶
                  </label>
                  <label className="text-ink flex items-center gap-2 text-[12px]">
                    <input
                      type="checkbox"
                      checked={allowComment}
                      onChange={(e) => setAllowComment(e.target.checked)}
                    />
                    允许评论
                  </label>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleSubmit()}
                    disabled={submitting}
                    className="bg-accent text-ink hover:bg-accent/90 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium shadow-sm transition-colors disabled:opacity-50"
                  >
                    {submitting ? '保存中…' : isEdit ? '保存修改' : '发布'}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="/60 text-ink hover:bg-surface inline-flex w-full items-center justify-center rounded-lg border px-3 py-1.5 text-[12px] transition-colors"
                  >
                    取消
                  </button>
                </div>
                <div className="text-muted text-center font-mono text-[10px] tracking-wide">
                  ⌘ + S 保存
                </div>
              </aside>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
