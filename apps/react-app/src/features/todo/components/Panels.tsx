import type { DevTaskPriority, DevTaskType } from '@/features/todo/api/types';
import {
  selectCompletedThisWeek,
  selectInProgress,
  selectFrontier,
  selectUrgentActive,
  selectTypeDistribution,
  selectWeekRangeDisplay,
  useTodoState,
} from '@/features/todo/stores/todoState';
import { useMemo, useState } from 'react';
import { FrontierCard } from './FrontierCard';
import { TaskRow } from './TaskRow';
import { PriorityBadge, StatusChip, TypeBadge } from './Badges';

// ── 推进 ──
interface PanelEmit {
  onOpen: (slug: string) => void;
  onCycle: (slug: string) => void;
  onDelete: (slug: string) => void;
}

export function FrontierPanel({ onOpen, onCycle, onDelete }: PanelEmit) {
  const tasks = useTodoState((s) => s.tasks);
  const frontier = useMemo(() => selectFrontier(tasks), [tasks]);
  const inProgress = useMemo(() => selectInProgress(tasks), [tasks]);
  const completedThisWeek = useMemo(
    () => selectCompletedThisWeek(tasks),
    [tasks],
  );

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-ink font-serif text-lg font-medium tracking-tight">
            现在能做什么
          </h2>
          <span className="text-muted text-xs">
            无阻塞 · 按优先级与截止日排序
          </span>
        </div>

        {frontier.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {frontier.map((task) => (
              <FrontierCard
                key={task.slug}
                task={task}
                onOpen={onOpen}
                onCycle={onCycle}
                onDelete={onDelete}
              />
            ))}
          </div>
        ) : (
          <div className="text-muted/70 flex flex-col items-center justify-center py-10 text-center">
            <svg
              className="text-muted/30 mb-2 h-8 w-8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <p className="text-sm font-medium">所有任务都已推进或还在阻塞中</p>
            <p className="text-xs">等待前置任务完成，或新建一个独立任务</p>
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-ink font-serif text-lg font-medium tracking-tight">
            进行中
          </h2>
          <span className="text-muted text-xs">正在推进的任务</span>
        </div>
        {inProgress.length ? (
          <div className="space-y-2">
            {inProgress.map((task) => (
              <TaskRow
                key={task.slug}
                task={task}
                onOpen={onOpen}
                onCycle={onCycle}
                onDelete={onDelete}
              />
            ))}
          </div>
        ) : (
          <div className="text-muted/70 flex items-center justify-center py-6 text-sm">
            暂无进行中的任务
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-ink font-serif text-lg font-medium tracking-tight">
            本周已完成
          </h2>
          <span className="text-muted text-xs">最近关闭的任务</span>
        </div>
        {completedThisWeek.length ? (
          <div className="space-y-2">
            {completedThisWeek.map((task) => (
              <TaskRow
                key={task.slug}
                task={task}
                done
                onOpen={onOpen}
                onDelete={onDelete}
              />
            ))}
          </div>
        ) : (
          <div className="text-muted/70 flex items-center justify-center py-6 text-sm">
            本周还没有完成的任务
          </div>
        )}
      </section>
    </div>
  );
}

// ── 规划 ──
const TASK_TYPES: DevTaskType[] = ['功能需求', '问题', '优化', '技术债'];
const PRIORITIES: DevTaskPriority[] = ['P0 紧急', 'P1 高', 'P2 中', 'P3 低'];

export function PlanningPanel({ onOpen, onDelete }: PanelEmit) {
  const tasks = useTodoState((s) => s.tasks);
  const [filterType, setFilterType] = useState<Set<DevTaskType>>(new Set());
  const [filterPriority, setFilterPriority] = useState<Set<DevTaskPriority>>(
    new Set(),
  );

  const filtered = useMemo(
    () =>
      tasks
        .filter((t) => !t.is_deleted && t.status !== '已完成')
        .filter((t) => (filterType.size ? filterType.has(t.type) : true))
        .filter((t) =>
          filterPriority.size ? filterPriority.has(t.priority) : true,
        ),
    [tasks, filterType, filterPriority],
  );

  function toggle(
    key: 'type' | 'priority',
    val: DevTaskType | DevTaskPriority,
  ) {
    if (key === 'type') {
      setFilterType((prev) => {
        const next = new Set(prev);
        const v = val as DevTaskType;
        if (next.has(v)) next.delete(v);
        else next.add(v);
        return next;
      });
    } else {
      setFilterPriority((prev) => {
        const next = new Set(prev);
        const v = val as DevTaskPriority;
        if (next.has(v)) next.delete(v);
        else next.add(v);
        return next;
      });
    }
  }

  return (
    <div className="space-y-4">
      <div
        className="bg-surface flex flex-wrap items-center gap-2 rounded-xl px-4 py-3"
        role="group"
        aria-label="筛选条件"
      >
        <span className="text-muted text-[10px] font-medium tracking-widest uppercase">
          类型
        </span>
        {TASK_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => toggle('type', t)}
            className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
              filterType.has(t)
                ? 'border-accent/40 bg-accent/10 text-ink'
                : 'text-muted hover:text-ink'
            }`}
          >
            {t}
          </button>
        ))}

        <span className="bg-border mx-1 h-4 w-px" />

        <span className="text-muted text-[10px] font-medium tracking-widest uppercase">
          优先级
        </span>
        {PRIORITIES.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => toggle('priority', p)}
            className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
              filterPriority.has(p)
                ? 'border-accent/40 bg-accent/10 text-ink'
                : 'text-muted hover:text-ink'
            }`}
          >
            {p}
          </button>
        ))}

        <span className="text-muted ml-auto text-xs tabular-nums">
          {filtered.length} 项
        </span>
      </div>

      {/* table */}
      <div className="overflow-hidden rounded-xl border">
        <div className="text-muted bg-surface grid grid-cols-[1fr_80px_32px] gap-4 border-b px-4 py-2.5 text-[10px] font-medium tracking-widest uppercase sm:grid-cols-[2fr_1fr_1fr_1fr_100px_32px]">
          <span>标题</span>
          <span className="max-sm:hidden">类型</span>
          <span className="max-sm:hidden">优先级</span>
          <span className="max-sm:hidden">范围</span>
          <span className="max-sm:hidden">状态</span>
          <span />
        </div>

        {filtered.map((task) => (
          <div
            key={task.slug}
            role="button"
            tabIndex={0}
            onClick={() => onOpen(task.slug)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onOpen(task.slug);
            }}
            className="hover:bg-surface/40 grid cursor-pointer grid-cols-[1fr_80px_32px] items-center gap-4 border-t px-4 py-2.5 transition-colors sm:grid-cols-[2fr_1fr_1fr_1fr_100px_32px]"
          >
            <span className="text-ink truncate text-sm font-medium">
              {task.title}
            </span>
            <span className="max-sm:hidden">
              <TypeBadge type={task.type} />
            </span>
            <span className="max-sm:hidden">
              <PriorityBadge priority={task.priority} />
            </span>
            <span className="text-muted truncate text-sm max-sm:hidden">
              {task.scope || '—'}
            </span>
            <span className="max-sm:hidden">
              <StatusChip status={task.status} />
            </span>
            <span className="flex justify-end">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(task.slug);
                }}
                className="text-muted hover:bg-destructive/10 hover:text-destructive focus-visible:ring-ring cursor-pointer rounded-md p-2 transition-[color,transform] focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none active:scale-[0.96]"
                title="删除"
                aria-label="删除"
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
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </span>
          </div>
        ))}

        {!filtered.length && (
          <div className="text-muted/70 px-4 py-8 text-center text-sm">
            没有匹配的任务
          </div>
        )}
      </div>
    </div>
  );
}

// ── 回顾 ──
const TYPE_COLORS: Record<DevTaskType, string> = {
  功能需求: 'var(--chart-1)',
  问题: 'var(--chart-4)',
  优化: 'var(--chart-5)',
  技术债: 'var(--chart-2)',
};

export function ReviewPanel({ onOpen }: Pick<PanelEmit, 'onOpen'>) {
  const tasks = useTodoState((s) => s.tasks);
  const completedThisWeek = useMemo(
    () => selectCompletedThisWeek(tasks),
    [tasks],
  );
  const stats = useMemo(
    () => [
      {
        label: '本周完成',
        value: completedThisWeek.length,
        delta: '最近自然周',
        deltaClass: 'text-success',
      },
      {
        label: '累计任务',
        value: tasks.filter((t) => !t.is_deleted).length,
        delta: '全部生命周期',
        deltaClass: 'text-muted',
      },
      {
        label: '进行中',
        value: selectInProgress(tasks).length,
        delta: '需要跟进',
        deltaClass: 'text-muted',
      },
      {
        label: 'P0 紧急',
        value: selectUrgentActive(tasks),
        delta: '需要关注',
        deltaClass: 'text-destructive',
      },
    ],
    [tasks, completedThisWeek],
  );

  const dist = useMemo(() => selectTypeDistribution(tasks), [tasks]);
  const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
  const distributionRows = (Object.keys(dist) as DevTaskType[]).map((type) => ({
    type,
    count: dist[type],
    pct: (dist[type] / total) * 100,
    color: TYPE_COLORS[type],
  }));

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-ink font-serif text-lg font-medium tracking-tight">
            本周概览
          </h2>
          <span className="text-muted text-xs">{selectWeekRangeDisplay()}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-page rounded-3xl border px-5 py-4 shadow-[0_1px_1px_color-mix(in_oklch,var(--ink)_6%,transparent),0_6px_14px_color-mix(in_oklch,var(--ink)_10%,transparent),0_18px_32px_color-mix(in_oklch,var(--ink)_8%,transparent)]"
            >
              <div className="text-muted text-[10px] font-medium tracking-widest uppercase">
                {stat.label}
              </div>
              <div className="text-ink font-family-averia mt-1 text-3xl leading-none font-normal tracking-tight">
                {stat.value}
              </div>
              <div className={`mt-1 text-xs ${stat.deltaClass}`}>
                {stat.delta}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-ink font-serif text-lg font-medium tracking-tight">
            类型分布
          </h2>
          <span className="text-muted text-xs">全部任务</span>
        </div>
        <div className="space-y-3">
          {distributionRows.map((row) => (
            <div key={row.type} className="flex items-center gap-3">
              <span className="text-ink w-16 shrink-0 text-sm">{row.type}</span>
              <div className="bg-surface h-2 flex-1 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full transition-transform duration-400"
                  style={{
                    width: '100%',
                    transform: `scaleX(${row.pct / 100})`,
                    backgroundColor: row.color,
                    transformOrigin: 'left',
                  }}
                />
              </div>
              <span className="text-muted w-6 shrink-0 text-right text-xs tabular-nums">
                {row.count}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-ink font-serif text-lg font-medium tracking-tight">
            最近完成
          </h2>
          <span className="text-muted text-xs">按完成时间倒序</span>
        </div>
        <div className="space-y-0">
          {completedThisWeek.slice(0, 8).map((task) => (
            <div key={task.slug} className="flex gap-3 border-t px-1 py-3">
              <div
                className="mt-2 h-2 w-2 shrink-0 rounded-full"
                style={{ background: 'var(--success)' }}
              />
              <div
                className="min-w-0 flex-1 cursor-pointer"
                onClick={() => onOpen(task.slug)}
              >
                <p className="text-muted truncate text-sm font-medium line-through">
                  {task.title}
                </p>
                <p className="text-muted/60 text-[11px] tabular-nums">
                  {(task.updated_at ?? '').slice(0, 10)}
                </p>
              </div>
            </div>
          ))}
          {!completedThisWeek.length && (
            <div className="text-muted/70 px-1 py-6 text-center text-sm">
              本周还没有完成的任务
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
