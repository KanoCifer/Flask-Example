import { BentoCard } from '@/components';
import { useTodoState, STATUS_STYLES, selectFrontier } from '@/features/todo';
import type { DevTask, DevTaskStatus } from '@/features/todo/api/types';
import { BookCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { SPRING } from '@/constants/springs';
import { useEffect, useMemo } from 'react';

function statusChipClasses(status: DevTaskStatus): string {
  const s = STATUS_STYLES[status];
  return `${s.bg} ${s.border} ${s.text}`;
}

function isOverdue(task: DevTask): boolean {
  if (!task.due_date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(task.due_date) < today;
}

export function BentoTodo() {
  const tasks = useTodoState((s) => s.tasks);
  const hydrateTasks = useTodoState((s) => s.hydrateTasks);
  const cycleStatus = useTodoState((s) => s.cycleStatus);

  // 挂载时取一次最新数据 — 确保首页快照不是空的
  useEffect(() => {
    hydrateTasks();
  }, [hydrateTasks]);

  const title = '开发任务';
  const activeTasks = useMemo(
    () => tasks.filter((t) => !t.is_deleted),
    [tasks],
  );
  const doneCount = activeTasks.filter((t) => t.status === '已完成').length;
  const progress =
    activeTasks.length > 0 ? (doneCount / activeTasks.length) * 100 : 0;

  const frontier = useMemo(() => selectFrontier(tasks).slice(0, 3), [tasks]);

  const taskList = frontier.map((t) => (
    <motion.div
      key={t.slug}
      layout
      transition={SPRING.card}
      className="group flex items-start gap-3 py-2.5"
    >
      <motion.button
        whileTap={{ scale: 0.94 }}
        transition={SPRING.snappy}
        onClick={() => cycleStatus(t.slug)}
        className={`mt-0.5 shrink-0 cursor-pointer rounded-md border px-2 py-0.5 text-[11px] font-medium transition-all duration-300 ease-out ${statusChipClasses(t.status)}`}
      >
        {t.status}
      </motion.button>

      <div className="min-w-0 flex-1">
        <span
          className={`text-sm leading-tight transition-colors duration-200 select-none ${
            t.status === '已完成' ? 'text-muted line-through' : 'text-ink'
          }`}
        >
          {t.title}
        </span>

        {t.due_date && (
          <span
            className={`ml-1.5 text-[10px] tabular-nums ${
              isOverdue(t) && t.status !== '已完成'
                ? 'text-destructive'
                : 'text-muted'
            }`}
          >
            {t.due_date}
          </span>
        )}
      </div>
    </motion.div>
  ));

  return (
    <BentoCard className="h-full">
      <div className="flex h-full flex-col">
        {/* 标题行 */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-muted text-xs font-bold tracking-wide uppercase">
            {title}
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-muted text-xs font-medium tabular-nums">
              {doneCount} / {activeTasks.length}
            </span>
            <Link
              to="/todos"
              className="text-muted hover:bg-surface hover:text-ink cursor-pointer rounded-md p-2 outline-0 transition-colors"
              title="查看详情"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </Link>
          </div>
        </div>

        {/* 进度条 */}
        <div className="bg-surface mb-4 h-1.5 overflow-hidden rounded-full">
          <motion.div
            className="bg-accent h-full rounded-full"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={SPRING.reveal}
          />
        </div>

        {/* 任务列表 */}
        <div className="contents">
          <div className="no-scrollbar mx-3 flex-1 overflow-y-auto">
            <AnimatePresence mode="popLayout">{taskList}</AnimatePresence>

            {activeTasks.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center py-6">
                <p className="text-md text-muted flex flex-col items-center gap-2 font-medium tracking-wide">
                  <BookCheck className="size-12" />
                  暂无开发任务
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </BentoCard>
  );
}
