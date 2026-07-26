import { useAuthStore } from '@/features/auth';
import {
  useTodoState,
  selectFrontier,
  selectTotalActive,
  selectCompletedCount,
} from '@/features/todo/stores/todoState';
import type {
  CreateDevTaskPayload,
  DevTask,
  DevTaskStatus,
} from '@/features/todo/api/types';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { McpTokenModal } from './components/McpTokenModal';
import { DevTaskModal } from './components/DevTaskModal';
import { TaskDetailPanel } from './components/TaskDetailPanel';
import { ConfirmDialog } from './components/ConfirmDialog';
import { FrontierPanel, PlanningPanel, ReviewPanel } from './components/Panels';

type TabId = 'frontier' | 'planning' | 'review';

interface TabDef {
  id: TabId;
  label: string;
}

const TAB_ITEM_HEIGHT = 36;

export default function TodoListView() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const tasks = useTodoState((s) => s.tasks);
  const hydrateTasks = useTodoState((s) => s.hydrateTasks);
  const createTask = useTodoState((s) => s.createTask);
  const updateTask = useTodoState((s) => s.updateTask);
  const deleteTask = useTodoState((s) => s.deleteTask);
  const hardDeleteTask = useTodoState((s) => s.hardDeleteTask);
  const cycleStatus = useTodoState((s) => s.cycleStatus);

  const [activeTab, setActiveTab] = useState<TabId>('frontier');
  const [mcpTokenOpen, setMcpTokenOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // 滑动指示器 refs
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicatorY, setIndicatorY] = useState(0);

  const tabs: TabDef[] = useMemo(
    () => [
      { id: 'frontier', label: '推进' },
      { id: 'planning', label: '规划' },
      { id: 'review', label: '回顾' },
    ],
    [],
  );

  const activeTabIndex = tabs.findIndex((t) => t.id === activeTab);

  useEffect(() => {
    setIndicatorY(activeTabIndex * TAB_ITEM_HEIGHT);
  }, [activeTabIndex]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    setLoading(true);
    hydrateTasks();
    // hydrateTasks 是 fire-and-forget；设一个最小 loading 时长避免闪烁
    const t = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [isAuthenticated, hydrateTasks]);

  // ── modal state ──
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<DevTask | null>(null);

  const openCreate = () => {
    setEditingTask(null);
    setModalOpen(true);
  };
  const openEdit = (slug: string) => {
    const task = tasks.find((x) => x.slug === slug) ?? null;
    setEditingTask(task);
    setDetailOpen(false);
    setModalOpen(true);
  };
  const handleCreate = async (payload: CreateDevTaskPayload) => {
    await createTask(payload);
    setModalOpen(false);
  };
  const handleUpdate = async (
    slug: string,
    patch: Partial<DevTask> & { title?: string },
  ) => {
    await updateTask(slug, patch);
    setModalOpen(false);
  };
  const handleHardDelete = async (slug: string) => {
    await hardDeleteTask(slug);
    setModalOpen(false);
    setDetailOpen(false);
  };

  // ── detail panel state ──
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTask, setDetailTask] = useState<DevTask | null>(null);

  const openDetail = (slug: string) => {
    const task = tasks.find((x) => x.slug === slug) ?? null;
    setDetailTask(task);
    setDetailOpen(true);
  };
  const handleSetStatus = async (slug: string, status: DevTaskStatus) => {
    await updateTask(slug, { status });
    const updated = tasks.find((t) => t.slug === slug) ?? null;
    setDetailTask(updated);
  };

  // ── delete confirm ──
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteSlug, setPendingDeleteSlug] = useState<string | null>(
    null,
  );

  const handleDelete = (slug: string) => {
    setPendingDeleteSlug(slug);
    setDeleteConfirmOpen(true);
  };
  const confirmDelete = async () => {
    const slug = pendingDeleteSlug;
    setDeleteConfirmOpen(false);
    setPendingDeleteSlug(null);
    if (slug) await deleteTask(slug);
  };

  const handleRefresh = () => {
    setLoading(true);
    hydrateTasks();
    setTimeout(() => setLoading(false), 500);
  };

  const panelProps = {
    onOpen: openDetail,
    onCycle: cycleStatus,
    onDelete: handleDelete,
  };

  return (
    <div className="bg-page flex min-h-screen w-full flex-col">
      {/* ── page header ── */}
      <header className="bg-page/75 sticky top-0 z-10 flex flex-wrap items-end justify-between gap-3 border-b px-5 py-3 backdrop-blur-sm sm:px-8">
        <div>
          <h1 className="text-ink ml-12 font-serif text-2xl leading-tight font-medium tracking-tight">
            开发任务
          </h1>
          <p className="text-muted mt-0.5 ml-12 font-serif text-sm italic">
            Agent-native Task Dashboard
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAuthenticated && (
            <>
              <button
                onClick={() => setMcpTokenOpen(true)}
                className="text-muted hover:bg-surface hover:text-ink focus-visible:ring-ring inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                title="签发 MCP 服务 Token"
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
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                  />
                </svg>
                MCP Token
              </button>

              <button
                onClick={handleRefresh}
                disabled={loading}
                className="text-muted hover:bg-surface hover:text-ink focus-visible:ring-ring inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-2 text-sm transition-[color,transform] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50"
                title="刷新任务列表"
              >
                <svg
                  className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>

              <button
                onClick={openCreate}
                className="bg-accent text-ink hover:bg-accent/90 focus-visible:ring-ring inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
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
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                新建任务
              </button>
            </>
          )}
        </div>
      </header>

      {/* ── main content ── */}
      <div className="flex flex-1">
        {/* ── sidebar (desktop tab nav with sliding indicator) ── */}
        <aside className="top-16 hidden w-52 shrink-0 space-y-1 self-start overflow-y-auto border-r px-4 py-6 lg:sticky lg:block lg:h-[calc(100vh-4rem)] lg:w-60">
          <div className="px-3 pb-2">
            <span className="text-muted text-[10px] font-medium tracking-widest uppercase">
              工作台
            </span>
          </div>
          <nav role="tablist" aria-label="工作台视角" className="relative">
            {/* 滑动指示器 */}
            <span
              className="tab-indicator bg-accent/10 absolute top-0 left-0 z-0 h-9 w-full rounded-lg shadow-[inset_0_1px_0_0_oklch(from_var(--page)_l_c_h_/_0.5),inset_0_-1px_1px_oklch(0_0_0_/_0.04)]"
              style={{ transform: `translateY(${indicatorY}px)` }}
            />
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                ref={(el) => {
                  if (el) tabRefs.current.set(tab.id, el);
                  else tabRefs.current.delete(tab.id);
                }}
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`focus-visible:ring-ring relative z-10 flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-[color,transform] duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.96] ${
                  activeTab === tab.id
                    ? 'text-ink'
                    : 'text-muted hover:text-ink'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span>{tab.label}</span>
                <span
                  className={`ml-3 inline-block min-w-[1.25rem] rounded-full px-1.5 text-center text-[10px] font-medium tabular-nums transition-[background-color,color] duration-150 ${
                    index === activeTabIndex
                      ? 'bg-accent/15 text-ink'
                      : 'bg-surface/10 text-muted'
                  }`}
                >
                  {tab.id === 'frontier'
                    ? selectFrontier(tasks).length
                    : tab.id === 'planning'
                      ? selectTotalActive(tasks)
                      : selectCompletedCount(tasks)}
                </span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="w-full min-w-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8">
          {/* mobile tab strip */}
          <nav
            role="tablist"
            aria-label="工作台视角"
            className="bg-surface mb-5 flex gap-0.5 rounded-lg p-1 lg:hidden"
          >
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`focus-visible:ring-ring relative flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-[color,transform] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.96] ${
                    isActive
                      ? 'bg-page text-ink shadow-[0_1px_2px_color-mix(in_oklch,var(--ink)_6%,transparent),inset_0_1px_0_0_oklch(from_var(--page)_l_c_h_/_0.6)]'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  {tab.label}
                  <span
                    className={`ml-1.5 inline-block min-w-[1.25rem] rounded-full px-1.5 text-center text-[10px] font-medium tabular-nums ${
                      isActive
                        ? 'text-ink bg-accent/15'
                        : 'text-muted bg-surface/10'
                    }`}
                  >
                    {tab.id === 'frontier'
                      ? selectFrontier(tasks).length
                      : tab.id === 'planning'
                        ? selectTotalActive(tasks)
                        : selectCompletedCount(tasks)}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* 未登录空状态 */}
          {!isAuthenticated && (
            <div className="flex h-full min-h-96 flex-col items-center justify-center gap-3 text-center">
              <svg
                className="text-muted/40 h-14 w-14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
              <p className="text-ink text-lg font-medium">
                请登录后使用开发任务
              </p>
              <p className="text-muted max-w-xs text-sm">
                开发任务看板用于管理网站的需求、问题与技术债，登录后即可查看与新建。
              </p>
              <a
                href="/login"
                className="bg-accent text-ink hover:bg-accent/90 focus-visible:ring-ring mt-1 cursor-pointer rounded-lg px-5 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                去登录
              </a>
            </div>
          )}

          {/* 加载态 */}
          {isAuthenticated && loading && (
            <div className="space-y-3">
              <div className="bg-surface h-8 w-40 animate-pulse rounded-md" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="bg-surface h-28 animate-pulse rounded-xl"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Tab content */}
          {isAuthenticated && !loading && (
            <div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeTab === 'frontier' && (
                    <FrontierPanel {...panelProps} />
                  )}
                  {activeTab === 'planning' && (
                    <PlanningPanel {...panelProps} />
                  )}
                  {activeTab === 'review' && (
                    <ReviewPanel onOpen={panelProps.onOpen} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          )}
        </main>
      </div>

      {/* ── create / edit modal ── */}
      <DevTaskModal
        open={modalOpen}
        task={editingTask}
        onClose={() => setModalOpen(false)}
        onSaveCreate={handleCreate}
        onSaveUpdate={handleUpdate}
        onHardDelete={handleHardDelete}
      />

      {/* ── detail slide-out panel (移动端 bottom-sheet) ── */}
      <TaskDetailPanel
        open={detailOpen}
        task={detailTask}
        onClose={() => setDetailOpen(false)}
        onSetStatus={handleSetStatus}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      {/* ── MCP token ── */}
      <McpTokenModal
        open={mcpTokenOpen}
        onClose={() => setMcpTokenOpen(false)}
      />

      {/* ── soft delete confirm ── */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        title="删除任务？"
        message="任务将被标记为已删除，可从后端恢复。"
        confirm-text="删除"
        cancel-text="取消"
        variant="default"
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
