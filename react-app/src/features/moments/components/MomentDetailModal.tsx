import { PinIcon } from '@/components';
import type {
  Moment,
  MomentAttachment,
  MomentStatus,
  MomentVisibility,
} from '@/types';
import { isPureEmoji } from '@/lib/emoji';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { MomentTagChip } from './MomentTagChip';
import { IconClose, IconChevronLeft, IconChevronRight } from './InlineIcons';

interface MomentDetailModalProps {
  open: boolean;
  moment: Moment | null;
  volumeLabel?: string;
  hasPrev?: boolean;
  hasNext?: boolean;
  isAdmin?: boolean;
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  onEdit?: (moment: Moment) => void;
  onDelete?: (moment: Moment) => void;
}

const VISIBILITY_LABEL: Record<MomentVisibility, string> = {
  public: '公开',
  unlisted: '不列出',
  private: '不公开',
};

const STATUS_LABEL: Record<MomentStatus, string> = {
  published: '已发布',
  draft: '草稿',
  archived: '归档',
};

export function MomentDetailModal({
  open,
  moment,
  volumeLabel = '',
  hasPrev = false,
  hasNext = false,
  isAdmin = false,
  onClose,
  onNavigate,
  onEdit,
  onDelete,
}: MomentDetailModalProps) {
  // ── 图片附件(详情查看,不引入新组件,inline lightbox) ──
  const imageAttachments = useMemo<MomentAttachment[]>(
    () => (moment?.attachments ?? []).filter((a) => a.type === 'image'),
    [moment?.attachments],
  );
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  function openLightbox(idx: number): void {
    setLightboxIndex(idx);
  }
  function closeLightbox(): void {
    setLightboxIndex(null);
  }
  function lightboxPrev(): void {
    const n = imageAttachments.length;
    if (n === 0 || lightboxIndex === null) return;
    setLightboxIndex(lightboxIndex <= 0 ? n - 1 : lightboxIndex - 1);
  }
  function lightboxNext(): void {
    const n = imageAttachments.length;
    if (n === 0 || lightboxIndex === null) return;
    setLightboxIndex(lightboxIndex >= n - 1 ? 0 : lightboxIndex + 1);
  }

  // 键盘：J/K 切换、Esc 关闭（lightbox 打开时让位给 lightbox 自己的 effect）
  useEffect(() => {
    if (!open) return;
    if (lightboxIndex !== null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'j' || e.key === 'J') {
        if (hasNext) {
          e.preventDefault();
          onNavigate('next');
        }
      } else if (e.key === 'k' || e.key === 'K') {
        if (hasPrev) {
          e.preventDefault();
          onNavigate('prev');
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, lightboxIndex, hasNext, hasPrev, onClose, onNavigate]);

  // lightbox 专用键盘 ←/→/Esc（与 modal 互斥，lightbox 优先）
  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeLightbox();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        lightboxPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        lightboxNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxIndex, imageAttachments.length]);

  return (
    <AnimatePresence>
      {open && moment && (
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
            className="bg-page /40 relative flex max-h-[88vh] w-full max-w-[720px] flex-col overflow-hidden rounded-xl border shadow-xl"
          >
            {/* Header */}
            <div className="/40 bg-page sticky top-0 z-10 flex items-center justify-between gap-2 border-b px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="text-ink/70 font-serif text-sm italic">
                  {volumeLabel}
                </span>
                <span className="text-muted/60">·</span>
                <span className="text-muted font-mono text-[11px] tracking-wide">
                  {moment.published_at
                    ? moment.published_at.replace('T', ' ').slice(0, 16)
                    : moment.created_at.replace('T', ' ').slice(0, 16)}
                </span>
                {moment.is_pinned && (
                  <span className="text-warning inline-flex items-center gap-1 text-[10px] font-semibold tracking-[0.18em] uppercase">
                    <span aria-hidden="true">·</span>
                    <PinIcon className="h-3 w-3" />
                    <span>置顶</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {(hasPrev || hasNext) && (
                  <div className="text-muted flex items-center gap-1 text-[11px]">
                    <button
                      type="button"
                      disabled={!hasPrev}
                      onClick={() => onNavigate('prev')}
                      className="hover:text-ink /40 inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="上一条"
                    >
                      <IconChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={!hasNext}
                      onClick={() => onNavigate('next')}
                      className="hover:text-ink /40 inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="下一条"
                    >
                      <IconChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                {isAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={() => onEdit?.(moment)}
                      className="bg-accent text-ink hover:bg-accent/90 inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-medium shadow-sm transition-colors"
                    >
                      <span>编辑</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete?.(moment)}
                      className="text-muted hover:text-destructive /40 hover:border-destructive/40 inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors"
                      aria-label="删除"
                    >
                      <span aria-hidden="true">🗑</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="text-muted hover:text-ink /40 inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors"
                  aria-label="关闭"
                >
                  <IconClose className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="grid grid-cols-1 gap-0 md:grid-cols-[minmax(0,1fr)_220px]">
              {/* Left: content */}
              <div
                className="overflow-y-auto px-8 py-8"
                style={{ maxHeight: 'calc(88vh - 64px)' }}
              >
                {moment.mood && (
                  <div className="text-muted mb-6 flex items-center gap-2 text-sm">
                    {isPureEmoji(moment.mood) ? (
                      <span className="text-2xl" aria-hidden="true">
                        {moment.mood}
                      </span>
                    ) : (
                      <span className="italic">{moment.mood}</span>
                    )}
                  </div>
                )}
                <div
                  className="text-ink/90 font-serif text-[16px] leading-loose"
                  style={{ textWrap: 'pretty', whiteSpace: 'pre-wrap' }}
                >
                  {moment.content}
                </div>

                {/* 附件图片网格(点击放大查看) */}
                {imageAttachments.length > 0 && (
                  <div className="mt-6 grid grid-cols-3 gap-2">
                    {imageAttachments.map((att, idx) => (
                      <button
                        key={att.url}
                        type="button"
                        className="bg-surface group relative aspect-square overflow-hidden rounded-xl"
                        aria-label={`查看图片 ${idx + 1}`}
                        onClick={() => openLightbox(idx)}
                      >
                        <img
                          src={att.url}
                          alt=""
                          className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {moment.tags.length > 0 && (
                  <div className="text-muted mt-8 flex flex-wrap items-center gap-2 text-[12px]">
                    {moment.tags.map((tag) => (
                      <MomentTagChip key={tag} name={tag} />
                    ))}
                  </div>
                )}
                <div className="text-muted /40 mt-10 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-dashed pt-4 font-mono text-[11px] tracking-wide">
                  <span>发布于 {moment.published_at ?? moment.created_at}</span>
                  {moment.source && (
                    <>
                      <span className="text-muted/60">·</span>
                      <span>来源 {moment.source}</span>
                    </>
                  )}
                  <span className="text-muted/60">·</span>
                  <span>允许评论 {moment.allow_comment ? '是' : '否'}</span>
                </div>
              </div>

              {/* Right: meta */}
              <aside className="bg-surface/30 /40 hidden border-l px-5 py-6 md:block">
                <div className="text-muted sticky top-4 font-mono text-[10px] tracking-[0.18em] uppercase">
                  META
                </div>
                <dl className="mt-4 space-y-3 text-sm">
                  <MetaRow label="卷序" value={volumeLabel} mono />
                  <MetaRow
                    label="心情"
                    value={
                      isPureEmoji(moment.mood ?? '')
                        ? (moment.mood ?? '')
                        : (moment.mood ?? '—')
                    }
                  />
                  <MetaRow label="标签" value={moment.tags.join(' · ')} />
                  {moment.location?.name && (
                    <MetaRow label="地点" value={moment.location.name} />
                  )}
                  <MetaRow
                    label="可见性"
                    value={VISIBILITY_LABEL[moment.visibility]}
                  />
                  <MetaRow label="状态" value={STATUS_LABEL[moment.status]} />
                </dl>

                <div className="text-muted /40 mt-6 border-t border-dashed pt-4 font-mono text-[10px] tracking-[0.18em] uppercase">
                  KEYBOARD
                </div>
                <ul className="text-muted mt-3 space-y-1.5 text-[12px]">
                  <li className="flex items-center gap-2">
                    <Kbd label="J" />
                    <span>下一条</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Kbd label="K" />
                    <span>上一条</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Kbd label="Esc" />
                    <span>关闭</span>
                  </li>
                </ul>
              </aside>
            </div>
          </motion.div>

          {/* 图片放大查看(inline lightbox,portal 到 body,沿用图片墙看图态) */}
          {imageAttachments.length > 0 &&
            createPortal(
              <AnimatePresence>
                {lightboxIndex !== null && (
                  <motion.div
                    key="moment-lightbox"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="fixed inset-0 z-[60] flex items-center justify-center"
                    role="dialog"
                    aria-modal="true"
                  >
                    {/* 遮罩 */}
                    <div
                      className="bg-ink/80 absolute inset-0 backdrop-blur-sm"
                      onClick={closeLightbox}
                    />

                    {/* 顶部工具条 */}
                    <div className="text-page absolute top-0 right-0 left-0 z-10 flex items-center justify-between px-5 py-4">
                      <span className="font-mono text-sm tabular-nums">
                        {lightboxIndex + 1} / {imageAttachments.length}
                      </span>
                      <button
                        type="button"
                        className="hover:bg-page/20 inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors"
                        aria-label="关闭"
                        onClick={closeLightbox}
                      >
                        <IconClose className="h-5 w-5" />
                      </button>
                    </div>

                    {/* 左切换 */}
                    {imageAttachments.length > 1 && (
                      <button
                        type="button"
                        className="text-page hover:bg-page/20 absolute left-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors"
                        aria-label="上一张"
                        onClick={lightboxPrev}
                      >
                        <IconChevronLeft className="h-6 w-6" />
                      </button>
                    )}

                    {/* 主图 */}
                    <img
                      src={imageAttachments[lightboxIndex]?.url ?? ''}
                      alt={`附件图片 ${lightboxIndex + 1}`}
                      className="relative z-[1] max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
                    />

                    {/* 右切换 */}
                    {imageAttachments.length > 1 && (
                      <button
                        type="button"
                        className="text-page hover:bg-page/20 absolute right-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors"
                        aria-label="下一张"
                        onClick={lightboxNext}
                      >
                        <IconChevronRight className="h-6 w-6" />
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>,
              document.body,
            )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MetaRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted font-mono text-[10px] tracking-[0.1em] uppercase">
        {label}
      </dt>
      <dd
        className={[
          'text-ink',
          mono ? 'font-mono text-[12px]' : 'font-serif text-[13px]',
        ].join(' ')}
      >
        {value || '—'}
      </dd>
    </div>
  );
}

function Kbd({ label }: { label: string }) {
  return (
    <kbd className="text-ink/80 bg-page /40 rounded border px-1.5 py-0.5 font-mono text-[10px]">
      {label}
    </kbd>
  );
}
