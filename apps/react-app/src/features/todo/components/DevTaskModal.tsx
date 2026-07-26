import { useEffect, useState } from 'react';
import type {
  CreateDevTaskPayload,
  DevTask,
  DevTaskPriority,
  DevTaskScope,
  DevTaskStatus,
  DevTaskType,
} from '@/features/todo/api/types';
import { ConfirmDialog } from './ConfirmDialog';
import { TodoModal } from './TodoModal';

const TASK_TYPES: DevTaskType[] = ['问题', '功能需求', '优化', '技术债'];
const PRIORITIES: DevTaskPriority[] = ['P0 紧急', 'P1 高', 'P2 中', 'P3 低'];
const STATUSES: DevTaskStatus[] = [
  '待评估',
  '待排期',
  '进行中',
  '已搁置',
  '已完成',
];

const TYPE_ACTIVE: Record<DevTaskType, string> = {
  问题: 'border-rose-300/60 bg-rose-50 text-rose-700 dark:border-rose-700/60 dark:bg-rose-950/30 dark:text-rose-400',
  功能需求:
    'border-blue-300/60 bg-blue-50 text-blue-700 dark:border-blue-700/60 dark:bg-blue-950/30 dark:text-blue-400',
  优化: 'border-amber-300/60 bg-amber-50 text-amber-700 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-400',
  技术债:
    'border-purple-300/60 bg-purple-50 text-purple-700 dark:border-purple-700/60 dark:bg-purple-950/30 dark:text-purple-400',
};

const PRIORITY_ACTIVE: Record<DevTaskPriority, string> = {
  'P0 紧急': 'border-destructive/40 bg-destructive/10 text-destructive',
  'P1 高':
    'border-orange-300/60 bg-orange-50 text-orange-700 dark:border-orange-700/60 dark:bg-orange-950/30 dark:text-orange-400',
  'P2 中': 'border-accent/40 bg-accent/10 text-ink',
  'P3 低': ' bg-surface text-muted',
};

interface FormState {
  slug?: string;
  title: string;
  description: string;
  detail: string;
  type: DevTaskType;
  priority: DevTaskPriority;
  scope: string;
  status: DevTaskStatus;
  due_date: string;
  acceptance_criteria: string;
  constraints: string;
  context_pointers: string;
}

function defaultForm(): FormState {
  return {
    title: '',
    description: '',
    detail: '',
    type: '功能需求',
    priority: 'P2 中',
    scope: '',
    status: '待评估',
    due_date: '',
    acceptance_criteria: '',
    constraints: '',
    context_pointers: '',
  };
}

interface DevTaskModalProps {
  open: boolean;
  task: DevTask | null;
  onClose: () => void;
  onSaveCreate: (payload: CreateDevTaskPayload) => void;
  onSaveUpdate: (slug: string, payload: Partial<DevTask>) => void;
  onHardDelete: (slug: string) => void;
}

export function DevTaskModal({
  open,
  task,
  onClose,
  onSaveCreate,
  onSaveUpdate,
  onHardDelete,
}: DevTaskModalProps) {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (task) {
      setForm({
        slug: task.slug,
        title: task.title ?? '',
        description: task.description ?? '',
        detail: task.detail ?? '',
        type: task.type,
        priority: task.priority,
        scope: task.scope ?? '',
        status: task.status,
        due_date: task.due_date ?? '',
        acceptance_criteria: task.acceptance_criteria ?? '',
        constraints: task.constraints ?? '',
        context_pointers: task.context_pointers ?? '',
      });
    } else {
      setForm(defaultForm());
    }
  }, [task, open]);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  function handleSave() {
    if (!form.title.trim()) return;
    // scope 是自由文本（后端接受任意 "<层>-<技术>" 格式）；显式断言以对齐前端枚举
    const base = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      detail: form.detail.trim() || undefined,
      type: form.type,
      priority: form.priority,
      scope: form.scope.trim() as DevTaskScope,
      due_date: form.due_date || undefined,
      acceptance_criteria: form.acceptance_criteria.trim() || undefined,
      constraints: form.constraints.trim() || undefined,
      context_pointers: form.context_pointers.trim() || undefined,
    };
    if (form.slug) {
      onSaveUpdate(form.slug, { ...base, status: form.status });
    } else {
      onSaveCreate(base);
    }
  }

  function handleHardDelete() {
    if (!form.slug) return;
    onHardDelete(form.slug);
  }

  return (
    <TodoModal open={open} size="xl" onClose={onClose}>
      <div className="flex max-h-[85vh] w-full flex-col">
        {/* Header — sticky */}
        <div className="bg-page shrink-0 border-b px-6 pt-5 pb-4">
          <div className="flex items-start gap-3">
            <span className="bg-accent/10 text-ink mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
              <svg
                className="h-[18px] w-[18px]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-ink text-lg font-semibold">
                {form.slug ? '编辑任务' : '新建任务'}
              </h2>
              <p className="text-muted mt-0.5 text-xs">
                记录一个待开发的需求、问题或技术债。带{' '}
                <span className="text-ink">*</span> 为必填。
              </p>
            </div>
          </div>
        </div>

        {/* Form (scrollable) */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-5">
            <label className="block">
              <span className="text-muted mb-1.5 block text-xs font-medium">
                标题 <span className="text-destructive">*</span>
              </span>
              <input
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                type="text"
                placeholder="例如：重构首页响应式布局"
                className="bg-page text-ink focus:border-accent placeholder:text-muted/50 w-full rounded-lg border px-3 py-2 text-sm outline-none"
              />
            </label>

            <div>
              <span className="text-muted mb-1.5 block text-xs font-medium">
                类型
              </span>
              <div className="flex flex-wrap gap-2">
                {TASK_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set('type', t)}
                    className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      form.type === t
                        ? TYPE_ACTIVE[t]
                        : 'text-muted hover:bg-surface'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-muted mb-1.5 block text-xs font-medium">
                优先级
              </span>
              <div className="flex flex-wrap gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => set('priority', p)}
                    className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      form.priority === p
                        ? PRIORITY_ACTIVE[p]
                        : 'text-muted hover:bg-surface'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <span className="text-muted mb-1.5 block text-xs font-medium">
                  范围{' '}
                  <span className="text-muted/60 font-normal">
                    （自由格式 — 例: 前端-React, 后端-Go, AI-LangChain）
                  </span>
                </span>
                <input
                  value={form.scope}
                  onChange={(e) => set('scope', e.target.value)}
                  type="text"
                  placeholder="例如：前端-React"
                  className="bg-page text-ink focus:border-accent placeholder:text-muted/50 w-full rounded-lg border px-3 py-2 text-sm outline-none"
                />
              </div>
              <label className="block">
                <span className="text-muted mb-1.5 block text-xs font-medium">
                  截止日
                </span>
                <input
                  value={form.due_date}
                  onChange={(e) => set('due_date', e.target.value)}
                  type="date"
                  className="bg-page text-ink focus:border-accent w-full cursor-pointer rounded-lg border px-3 py-2 text-sm outline-none"
                />
              </label>
            </div>

            {form.slug && (
              <div>
                <span className="text-muted mb-1.5 block text-xs font-medium">
                  状态
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => set('status', s)}
                      className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                        form.status === s
                          ? 'border-accent/40 bg-accent/10 text-ink'
                          : 'text-muted hover:bg-surface'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <label className="block">
              <span className="text-muted mb-1.5 block text-xs font-medium">
                描述
              </span>
              <textarea
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                rows={3}
                placeholder="一两句话说清楚要做什么、为什么..."
                className="bg-page text-ink focus:border-accent placeholder:text-muted/50 w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none"
              />
            </label>

            <label className="block">
              <span className="text-muted mb-1.5 block text-xs font-medium">
                详情
              </span>
              <textarea
                value={form.detail}
                onChange={(e) => set('detail', e.target.value)}
                rows={6}
                placeholder="实现思路、参考链接、验收标准等，可较长..."
                className="bg-page text-ink focus:border-accent placeholder:text-muted/50 w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none"
              />
              <span className="text-muted/60 mt-1 block text-[11px]">
                支持比描述更长的自由文本
              </span>
            </label>

            <label className="block">
              <span className="text-muted mb-1.5 block text-xs font-medium">
                验收标准{' '}
                <span className="text-muted/60 font-normal">
                  （满足这几条算完成 — agent 会逐条自检）
                </span>
              </span>
              <textarea
                value={form.acceptance_criteria}
                onChange={(e) => set('acceptance_criteria', e.target.value)}
                rows={4}
                placeholder={
                  '- 所有接口有单测覆盖\n- 文档同步更新\n- 性能基准不降级'
                }
                className="bg-page text-ink focus:border-accent placeholder:text-muted/50 w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none"
              />
            </label>

            <label className="block">
              <span className="text-muted mb-1.5 block text-xs font-medium">
                约束{' '}
                <span className="text-muted/60 font-normal">
                  （agent 不可违反的硬性边界）
                </span>
              </span>
              <textarea
                value={form.constraints}
                onChange={(e) => set('constraints', e.target.value)}
                rows={4}
                placeholder={
                  '- 不动 src/legacy/ 目录\n- 后端继续用 Gin，不换框架\n- API 响应格式保持不变'
                }
                className="bg-page text-ink focus:border-accent placeholder:text-muted/50 w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none"
              />
            </label>

            <label className="block">
              <span className="text-muted mb-1.5 block text-xs font-medium">
                上下文指针{' '}
                <span className="text-muted/60 font-normal">
                  （相关代码 / 文档路径，减少 agent 找文件的往返）
                </span>
              </span>
              <textarea
                value={form.context_pointers}
                onChange={(e) => set('context_pointers', e.target.value)}
                rows={4}
                placeholder="internal/auth/, docs/adr/0003, src/middleware/session.ts"
                className="bg-page text-ink focus:border-accent placeholder:text-muted/50 w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none"
              />
            </label>
          </div>
        </div>

        {/* Footer (sticky) */}
        <div className="bg-page flex shrink-0 items-center justify-between border-t px-6 pt-4 pb-5">
          {form.slug ? (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="text-destructive hover:bg-destructive/10 focus-visible:ring-destructive/30 cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              永久删除
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-muted hover:bg-surface focus-visible:ring-ring cursor-pointer rounded-lg px-3.5 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!form.title.trim()}
              className="bg-accent text-ink hover:bg-accent/90 focus-visible:ring-ring cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              {form.slug ? '保存' : '创建'}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="永久删除任务？"
        message="此操作不可撤销，任务将从数据库中彻底移除。"
        confirm-text="永久删除"
        cancel-text="再想想"
        variant="destructive"
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleHardDelete}
      />
    </TodoModal>
  );
}
