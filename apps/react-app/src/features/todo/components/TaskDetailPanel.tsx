import { AnimatePresence, motion } from 'framer-motion';
import type { DevTask, DevTaskStatus } from '@/features/todo/api/types';
import { useNavVisibility } from '@/layouts';
import { useEffect, useMemo } from 'react';
import { renderMarkdown } from '@/lib/markdown';
import {
  BadgeRow,
  KindBadge,
  PriorityBadge,
  ScopeBadge,
  SlugBadge,
  TypeBadge,
} from './Badges';

const STATUSES: DevTaskStatus[] = ['待评估', '待排期', '进行中', '已完成'];

function isOverdue(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr) < today;
}

interface TaskDetailPanelProps {
  open: boolean;
  task: DevTask | null;
  onClose: () => void;
  onSetStatus: (slug: string, status: DevTaskStatus) => void;
  onEdit: (slug: string) => void;
  onDelete: (slug: string) => void;
}

export function TaskDetailPanel({
  open,
  task,
  onClose,
  onSetStatus,
  onEdit,
  onDelete,
}: TaskDetailPanelProps) {
  const { hideNav, showNav } = useNavVisibility();

  useEffect(() => {
    if (open) hideNav();
    else showNav();
    return () => showNav();
  }, [open, hideNav, showNav]);

  // 锁滚动
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const statusIndex = useMemo(
    () => (task ? STATUSES.indexOf(task.status) : -1),
    [task],
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="detail-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="bg-ink/35 fixed inset-0 z-[9998] backdrop-blur-[6px]"
          onClick={onClose}
        />
      )}
      {open && (
        <motion.aside
          key="detail-panel"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{
            type: 'spring',
            stiffness: 320,
            damping: 32,
            mass: 0.8,
          }}
          className="bg-page fixed right-0 bottom-0 left-0 z-[9999] flex max-h-[85vh] flex-col rounded-t-3xl shadow-[0_-12px_32px_color-mix(in_oklch,var(--ink)_10%,transparent)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-title"
          onClick={(e) => e.stopPropagation()}
        >
          {/* header */}
          <header className="flex shrink-0 items-start justify-between gap-3 border-b px-5 pt-4 pb-3">
            <h2
              id="detail-title"
              className="text-ink min-w-0 flex-1 truncate pr-2 font-serif text-lg leading-tight font-medium"
            >
              {task?.title || '任务详情'}
            </h2>
            <button
              type="button"
              className="text-muted hover:bg-surface hover:text-ink focus-visible:ring-ring cursor-pointer rounded-md p-2 transition-[color,transform] focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none active:scale-[0.96]"
              aria-label="关闭"
              onClick={onClose}
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </header>

          {/* body */}
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {!task ? (
              <div className="flex h-full min-h-72 flex-col items-center justify-center gap-3 text-center">
                <svg
                  className="text-muted/40 h-10 w-10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-ink text-sm font-medium">找不到这个任务</p>
                <p className="text-muted max-w-[260px] text-xs leading-relaxed">
                  它可能已被删除，或链接错误。
                </p>
              </div>
            ) : (
              <>
                {/* 主区：状态流转 */}
                <div className="mb-6 w-full">
                  <ol className="flex items-stretch" role="list">
                    {STATUSES.map((s, i) => (
                      <li
                        key={s}
                        className="relative flex flex-1 flex-col items-center"
                      >
                        <button
                          type="button"
                          className={`focus-visible:ring-ring flex items-center gap-1 rounded-full border-2 px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none ${
                            i < statusIndex
                              ? 'border-success bg-success/10 text-success'
                              : i === statusIndex
                                ? 'border-accent/40 bg-accent/10 text-ink'
                                : 'text-muted opacity-60'
                          }`}
                          aria-pressed={task.status === s}
                          onClick={() =>
                            task.status !== s && onSetStatus(task.slug, s)
                          }
                        >
                          {i < statusIndex ? (
                            <svg
                              className="h-3 w-3"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          ) : (
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                i === statusIndex ? 'bg-accent' : 'bg-border'
                              }`}
                            />
                          )}
                          {s}
                        </button>
                      </li>
                    ))}
                  </ol>
                  {task.status !== '已完成' && task.status !== '已搁置' && (
                    <button
                      type="button"
                      className="text-muted hover:bg-surface focus-visible:ring-ring hover:text-ink mx-auto mt-2 block max-w-xs cursor-pointer rounded-md px-2 py-2 text-center text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
                      onClick={() => onSetStatus(task.slug, '已搁置')}
                    >
                      搁置此任务
                    </button>
                  )}
                  {task.status === '已搁置' && (
                    <p className="text-muted mt-2 text-center text-[11px]">
                      已搁置 — 从上面选择一个状态恢复
                    </p>
                  )}
                </div>

                {/* 工作区：关键属性行 */}
                <div className="mb-6 space-y-3">
                  <BadgeRow>
                    <TypeBadge type={task.type} />
                    <PriorityBadge priority={task.priority} />
                    <KindBadge kind={task.kind} />
                    {task.scope && <ScopeBadge scope={task.scope} />}
                    {task.slug && <SlugBadge slug={task.slug} />}
                  </BadgeRow>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                    {task.parent_slug && (
                      <span className="text-muted">
                        归属{' '}
                        <span className="text-ink font-mono font-medium">
                          {task.parent_slug}
                        </span>
                      </span>
                    )}
                    {task.due_date && (
                      <span
                        className={`flex items-center gap-1 ${
                          isOverdue(task.due_date)
                            ? 'text-destructive'
                            : 'text-muted'
                        }`}
                      >
                        <svg
                          className="h-3 w-3"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 1 1 0 0 0 0-2H6z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {task.due_date}
                      </span>
                    )}
                    {task.blocked_by && task.blocked_by.length > 0 && (
                      <span
                        className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          background: 'var(--warning)',
                          color: 'oklch(0.2 0.02 50)',
                        }}
                      >
                        ⛔ 依赖 {task.blocked_by.length} 项
                      </span>
                    )}
                  </div>
                </div>

                {/* 主区：描述 + 详情 */}
                {task.description && (
                  <div
                    className="prose prose-sm text-ink mb-5 max-w-none leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdown(task.description),
                    }}
                  />
                )}
                {task.detail && (
                  <div
                    className="prose prose-sm text-ink mb-5 max-w-none leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: renderMarkdown(task.detail),
                    }}
                  />
                )}

                <hr className="my-5" />

                {/* 附区：元信息 */}
                <div className="space-y-4">
                  {task.acceptance_criteria && (
                    <div>
                      <span className="text-muted mb-1 block text-[10px] font-medium tracking-widest uppercase">
                        验收标准
                      </span>
                      <div
                        className="prose prose-sm text-muted max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: renderMarkdown(task.acceptance_criteria),
                        }}
                      />
                    </div>
                  )}

                  {task.constraints && (
                    <div>
                      <span className="text-muted mb-1 block text-[10px] font-medium tracking-widest uppercase">
                        约束
                      </span>
                      <div
                        className="prose prose-sm text-muted max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: renderMarkdown(task.constraints),
                        }}
                      />
                    </div>
                  )}

                  {task.context_pointers && (
                    <div>
                      <span className="text-muted mb-1 block text-[10px] font-medium tracking-widest uppercase">
                        上下文指针
                      </span>
                      <pre className="text-muted font-mono text-[12px] leading-relaxed break-words whitespace-pre-wrap">
                        {task.context_pointers}
                      </pre>
                    </div>
                  )}

                  <div>
                    <span className="text-muted mb-1 block text-[10px] font-medium tracking-widest uppercase">
                      元数据
                    </span>
                    <p className="text-muted font-mono text-[11px] leading-relaxed">
                      ID: {task.id}
                      <br />
                      创建于 {(task.created_at || '').slice(0, 10)} · 更新于
                      {(task.updated_at || '').slice(0, 10)}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* footer */}
          {task && (
            <footer className="flex shrink-0 items-center justify-between gap-2 border-t px-5 py-3">
              <button
                type="button"
                onClick={() => onDelete(task.slug)}
                className="text-destructive hover:bg-destructive/10 focus-visible:ring-destructive/30 cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                永久删除
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-muted hover:bg-surface focus-visible:ring-ring cursor-pointer rounded-lg px-3.5 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  关闭
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(task.slug)}
                  className="bg-accent text-ink hover:bg-accent/90 focus-visible:ring-ring cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  编辑
                </button>
              </div>
            </footer>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
