import { CircleCheckBig } from 'lucide-react';
import type { DevTask } from '@/features/todo/api/types';
import { renderMarkdown } from '@/lib/markdown';
import { KindBadge, PriorityBadge, TypeBadge } from './Badges';

interface FrontierCardProps {
  task: DevTask;
  onOpen: (slug: string) => void;
  onCycle: (slug: string) => void;
  onDelete: (slug: string) => void;
}

function overdue(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(dateStr) < today;
}

export function FrontierCard({
  task,
  onOpen,
  onCycle,
  onDelete,
}: FrontierCardProps) {
  return (
    <article className="bg-page group flex flex-col rounded-3xl border p-4 shadow-[0_1px_1px_color-mix(in_oklch,var(--ink)_6%,transparent),0_6px_14px_color-mix(in_oklch,var(--ink)_10%,transparent),0_18px_32px_color-mix(in_oklch,var(--ink)_8%,transparent)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_2px_2px_color-mix(in_oklch,var(--ink)_7%,transparent),0_10px_22px_color-mix(in_oklch,var(--ink)_12%,transparent),0_24px_40px_color-mix(in_oklch,var(--ink)_10%,transparent)]">
      <button
        type="button"
        onClick={() => onOpen(task.slug)}
        className="focus-visible:ring-ring flex w-full flex-col items-stretch text-left focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <span className="mb-2 flex flex-wrap items-center gap-1">
          <CircleCheckBig className="text-ink size-5" />
          <TypeBadge type={task.type} />
          <PriorityBadge priority={task.priority} />
          <KindBadge kind={task.kind} />
          {task.scope && (
            <span className="text-muted rounded-full border px-1.5 py-px text-[10px]">
              {task.scope}
            </span>
          )}
          {task.slug && (
            <span className="bg-accent/10 text-ink rounded-full px-1.5 py-px text-[10px] font-medium">
              {task.slug}
            </span>
          )}
        </span>

        <span className="text-ink text-sm font-medium">{task.title}</span>

        {task.description && (
          <span
            className="prose prose-sm mt-1 line-clamp-2 text-xs"
            dangerouslySetInnerHTML={{
              __html: renderMarkdown(task.description),
            }}
          />
        )}
      </button>

      <div className="mt-3 flex items-center justify-between gap-2">
        {task.due_date ? (
          <span
            className={`flex items-center gap-1 text-[10px] ${
              overdue(task.due_date) ? 'text-destructive' : 'text-muted'
            }`}
          >
            <svg
              className="h-2.5 w-2.5"
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
        ) : (
          <span className="flex-1" />
        )}

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCycle(task.slug);
            }}
            className="text-muted hover:bg-surface hover:text-ink focus-visible:ring-ring cursor-pointer rounded-md p-1 transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
            title="推进状态"
            aria-label="推进状态"
          >
            <svg
              className="h-3.5 w-3.5"
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
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task.slug);
            }}
            className="text-muted hover:bg-destructive/10 hover:text-destructive focus-visible:ring-ring cursor-pointer rounded-md p-1 transition-colors focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
            title="删除"
            aria-label="删除"
          >
            <svg
              className="h-3.5 w-3.5"
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
        </div>
      </div>
    </article>
  );
}
