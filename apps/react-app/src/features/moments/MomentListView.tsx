import { BasicDetail } from '@/components';
import { useAuthStore } from '@/features/auth';
import { useMomentsStore } from '@/features/moments/stores/momentsState';
import { useNotificationStore } from '@/stores/notificationState';
import type { Moment, MomentUpdatePayload } from '@/types';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MomentCard } from './components/MomentCard';
import { MomentDetailModal } from './components/MomentDetailModal';
import { MomentEditorModal } from './components/MomentEditorModal';
import { MomentEmptyState } from './components/MomentEmptyState';

const VOLUME_MAP = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

const formatVolume = (index: number): string => {
  const n = index + 1;
  if (n > 99) return `卷 ${n}`;
  if (n < 10) return `卷${VOLUME_MAP[n]}`;
  if (n < 20) return `十${n === 10 ? '' : VOLUME_MAP[n - 10]}`;
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${VOLUME_MAP[tens]}十${ones === 0 ? '' : VOLUME_MAP[ones]}`;
};

const formatError = (err: unknown, fallback: string) => {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
};

export default function MomentListView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const store = useMomentsStore();
  const auth = useAuthStore();
  const notifier = useNotificationStore();

  const isAdmin = !!auth.user?.is_admin;

  const publicList = store.publicList;
  const publicTotal = store.publicTotal;
  const publicPage = store.publicPage;
  const publicPageSize = store.publicPageSize;
  const publicActiveTag = store.publicActiveTag;
  const loading = store.loading;
  const submitting = store.submitting;

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const initialPage = useMemo(
    () => {
      const raw = searchParams.get('page');
      const n = raw ? Number(raw) : 1;
      return Number.isFinite(n) && n > 0 ? n : 1;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- computed once at mount
    [],
  );

  const initialTag = useMemo(
    () => searchParams.get('tag') ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- computed once at mount
    [],
  );

  // ── 数据加载 ──
  const load = async (page: number, tag: string | null) => {
    setErrorMessage(null);
    try {
      await store.fetchPublic({
        page,
        page_size: 20,
        tag: tag ?? undefined,
      });
    } catch (err) {
      setErrorMessage(formatError(err, '加载碎碎念失败'));
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(initialPage, initialTag);
    // 监听 query 变化
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  const totalPages = Math.max(1, Math.ceil(publicTotal / publicPageSize));

  const allTags = useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const m of publicList as Moment[]) {
      for (const t of m.tags) set.add(t);
    }
    return [...set].sort();
  }, [publicList]);

  const setTag = (tag: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (tag) {
      next.set('tag', tag);
      next.delete('page');
    } else {
      next.delete('tag');
      next.delete('page');
    }
    setSearchParams(next, { replace: true });
  };

  const goPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    const next = new URLSearchParams(searchParams);
    next.set('page', String(page));
    setSearchParams(next, { replace: true });
  };

  const handleReload = () => {
    void load(publicPage, publicActiveTag);
  };

  const heroTitle = '碎碎念';
  const heroSubtitle = `卷 · ${dayjs().format('YYYY')}`;

  // ────────────────────────────────────────────────────────────
  // Modal 状态
  // ────────────────────────────────────────────────────────────
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingMoment, setEditingMoment] = useState<Moment | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingMoment, setDeletingMoment] = useState<Moment | null>(null);

  const activeMoment = useMemo<Moment | null>(
    () => publicList.find((m) => m.id === detailId) ?? null,
    [publicList, detailId],
  );

  const detailIndex = useMemo(
    () => (detailId ? publicList.findIndex((m) => m.id === detailId) : -1),
    [publicList, detailId],
  );

  const hasPrev = detailIndex > 0;
  const hasNext = detailIndex >= 0 && detailIndex < publicList.length - 1;
  const activeVolumeLabel = detailIndex >= 0 ? formatVolume(detailIndex) : '';

  function openDetail(id: string) {
    setDetailId(id);
    setDetailOpen(true);
  }

  function navigateDetail(dir: 'prev' | 'next') {
    const nextIdx = dir === 'prev' ? detailIndex - 1 : detailIndex + 1;
    const next = publicList[nextIdx];
    if (next) setDetailId(next.id);
  }

  function openEditor(moment: Moment | null) {
    setEditingMoment(moment);
    setEditorOpen(true);
    if (detailOpen) setDetailOpen(false);
  }

  async function handleEditorSubmit(payload: MomentUpdatePayload) {
    const isEdit = !!editingMoment;
    try {
      if (isEdit && editingMoment) {
        await store.update(editingMoment.id, payload);
        notifier.success('已保存修改');
      } else {
        const created = await store.create({
          content: payload.content ?? '',
          summary: payload.summary ?? null,
          visibility: payload.visibility ?? 'public',
          status: payload.status ?? 'published',
          mood: payload.mood ?? null,
          tags: payload.tags ?? [],
          attachments: payload.attachments,
          location: payload.location,
          source: payload.source,
          is_pinned: payload.is_pinned ?? false,
          allow_comment: payload.allow_comment ?? true,
          published_at: payload.published_at ?? null,
        });
        notifier.success('发布成功');
        await load(1, publicActiveTag);
        if (created?.id) setDetailId(created.id);
      }
      setEditorOpen(false);
    } catch (err) {
      notifier.error(formatError(err, '保存失败'));
    }
  }

  function confirmDelete(moment: Moment | null) {
    if (!moment) return;
    setDeletingMoment(moment);
    setDeleteConfirmOpen(true);
    if (detailOpen) setDetailOpen(false);
  }

  async function handleDelete() {
    const m = deletingMoment;
    if (!m) return;
    try {
      await store.remove(m.id);
      notifier.success('已删除');
      setDeletingMoment(null);
      setDeleteConfirmOpen(false);
    } catch (err) {
      notifier.error(formatError(err, '删除失败'));
    }
  }

  return (
    <>
      <BasicDetail title={heroTitle} subtitle={heroSubtitle}>
        <div className="col-span-full container mx-auto min-h-dvh max-w-2xl px-4 py-8">
          {allTags.length > 0 && (
            <div
              className="mb-6 flex flex-wrap items-center gap-2 text-[12px]"
              aria-label="按标签过滤"
            >
              <button
                type="button"
                className={[
                  'rounded-full px-3 py-1 font-medium transition-colors',
                  publicActiveTag === null
                    ? 'bg-accent text-ink shadow-sm'
                    : 'bg-page text-muted hover:bg-surface /60 border',
                ].join(' ')}
                onClick={() => setTag(null)}
              >
                全部
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={[
                    'rounded-full px-3 py-1 font-medium transition-colors',
                    publicActiveTag === tag
                      ? 'bg-accent text-ink shadow-sm'
                      : 'bg-page text-muted hover:bg-surface /60 border',
                  ].join(' ')}
                  onClick={() => setTag(tag)}
                >
                  <span className="text-ink/70">#</span>
                  {tag}
                </button>
              ))}
            </div>
          )}

          {errorMessage && (
            <div
              className="border-destructive/30 bg-destructive/10 text-destructive mb-6 flex items-center gap-2 rounded-xl border p-4 text-sm"
              role="alert"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="flex-1">{errorMessage}</span>
              <button
                type="button"
                className="hover:text-destructive/80 text-xs underline underline-offset-2"
                onClick={handleReload}
              >
                重试
              </button>
            </div>
          )}

          {loading && publicList.length === 0 ? (
            <div className="space-y-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-page/60 /40 h-32 animate-pulse rounded-2xl border"
                />
              ))}
            </div>
          ) : publicList.length > 0 ? (
            <div className="space-y-5">
              {publicList.map((moment, index) => (
                <MomentCard
                  key={moment.id}
                  moment={moment}
                  volumeLabel={formatVolume(index)}
                  isAdmin={isAdmin}
                  onOpen={openDetail}
                  onEdit={openEditor}
                  onDelete={confirmDelete}
                />
              ))}
            </div>
          ) : (
            <MomentEmptyState
              title={
                publicActiveTag
                  ? `还没有 #${publicActiveTag} 的碎碎念`
                  : '还没有碎碎念'
              }
              description="等到想写一句的时候，再来吧。"
            />
          )}

          {publicTotal > publicPageSize && (
            <nav
              className="text-muted mt-10 flex items-center justify-between text-xs"
              aria-label="碎碎念分页"
            >
              <button
                type="button"
                disabled={publicPage <= 1}
                className="bg-page text-ink hover:bg-surface /60 inline-flex items-center gap-1.5 rounded-full border px-4 py-2 font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => goPage(publicPage - 1)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 19.5L8.25 12l7.5-7.5"
                  />
                </svg>
                上一页
              </button>

              <span className="font-serif tracking-wider tabular-nums">
                第 {publicPage} / {totalPages} 卷
              </span>

              <button
                type="button"
                disabled={publicPage >= totalPages}
                className="bg-page text-ink hover:bg-surface /60 inline-flex items-center gap-1.5 rounded-full border px-4 py-2 font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => goPage(publicPage + 1)}
              >
                下一页
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.25 4.5l7.5 7.5-7.5 7.5"
                  />
                </svg>
              </button>
            </nav>
          )}
        </div>
      </BasicDetail>

      {/* Admin FAB */}
      {isAdmin && (
        <button
          type="button"
          onClick={() => openEditor(null)}
          className="bg-accent text-ink hover:bg-accent/90 fixed right-6 bottom-6 z-[60] inline-flex items-center gap-1.5 rounded-full px-5 py-3 text-[13px] font-medium shadow-lg transition-all hover:shadow-xl"
          aria-label="新建碎碎念"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          写一句
        </button>
      )}

      <MomentDetailModal
        open={detailOpen}
        moment={activeMoment}
        volumeLabel={activeVolumeLabel}
        hasPrev={hasPrev}
        hasNext={hasNext}
        isAdmin={isAdmin}
        onClose={() => setDetailOpen(false)}
        onNavigate={navigateDetail}
        onEdit={openEditor}
        onDelete={confirmDelete}
      />

      <MomentEditorModal
        open={editorOpen}
        moment={editingMoment}
        submitting={submitting}
        onClose={() => setEditorOpen(false)}
        onSubmit={handleEditorSubmit}
      />

      {/* 删除确认 modal（inline，避免依赖缺失的 shadcn Dialog） */}
      {deleteConfirmOpen && (
        <div
          className="bg-page/60 fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setDeleteConfirmOpen(false)}
        >
          <div
            className="bg-page /40 w-full max-w-[420px] rounded-xl border p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-ink font-serif text-lg font-medium">
              删除这条碎碎念？
            </h3>
            <p className="text-muted mt-2 text-sm">
              将软删除该条记录（deleted_at 置位），列表中将不再展示。
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="/60 text-ink hover:bg-surface inline-flex items-center rounded-lg border px-3 py-1.5 text-[13px] transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="bg-destructive hover:bg-destructive/90 inline-flex items-center rounded-lg px-3 py-1.5 text-[13px] font-medium text-white transition-colors"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
