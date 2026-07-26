import type { DevTask } from '@/features/todo/api/types';
import { KindBadge, PriorityBadge, TypeBadge } from './Badges';

interface TaskRowProps {
  task: DevTask;
  done?: boolean;
  onOpen: (slug: string) => void;
  onCycle?: (slug: string) => void;
  onDelete: (slug: string) => void;
}

export function TaskRow({
  task,
  done = false,
  onOpen,
  onCycle,
  onDelete,
}: TaskRowProps) {
  return (
    <div className="bg-page group flex items-center gap-3 rounded-xl border px-4 py-2.5 transition-[box-shadow] duration-200 hover:shadow-[0_1px_1px_color-mix(in_oklch,var(--ink)_6%,transparent),0_6px_14px_color-mix(in_oklch,var(--ink)_10%,transparent)]">
      <button
        type="button"
        onClick={() => onOpen(task.slug)}
        className="focus-visible:ring-ring flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <span
          className={`text-ink min-w-0 flex-1 truncate text-sm font-medium ${
            done ? 'text-muted line-through opacity-70' : ''
          }`}
        >
          {task.title}
        </span>

        <span className="flex shrink-0 items-center gap-1.5">
          <TypeBadge type={task.type} />
          <PriorityBadge priority={task.priority} />
          {task.kind === 'subtask' && <KindBadge kind={task.kind} />}
        </span>

        {task.due_date && (
          <span className="text-muted shrink-0 text-[10px] tabular-nums">
            {task.due_date}
          </span>
        )}
      </button>

      <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        {!done && onCycle && (
          <button
            type="button"
            onClick={() => onCycle(task.slug)}
            className="text-muted hover:bg-surface hover:text-ink focus-visible:ring-ring cursor-pointer rounded-md p-2 transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none active:scale-[0.96]"
            title="推进状态"
            aria-label="推进状态"
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
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(task.slug)}
          className="text-muted hover:bg-destructive/10 hover:text-destructive focus-visible:ring-ring cursor-pointer rounded-md p-2 transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none active:scale-[0.96]"
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
  );
}
