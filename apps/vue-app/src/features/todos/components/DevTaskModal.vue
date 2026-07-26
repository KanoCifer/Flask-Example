<template>
  <ui-modal :open="open" size="xl" @close="emit('close')">
    <!-- 外层 flex 列：限制总高度，让表单区独立滚动 -->
    <div class="flex max-h-[85vh] w-full flex-col">
      <!-- ── 头部 ── -->
      <div class="bg-card border-b px-6 pt-5 pb-4">
        <div class="flex items-start gap-3">
          <span
            class="bg-accent/10 text-ink mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          >
            <svg
              class="h-[18px] w-[18px]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
          </span>
          <div class="min-w-0 flex-1">
            <h2 class="text-ink text-lg font-semibold">
              {{ form.slug ? '编辑任务' : '新建任务' }}
            </h2>
            <p class="text-muted mt-0.5 text-xs">
              记录一个待开发的需求、问题或技术债。带
              <span class="text-ink">*</span> 为必填。
            </p>
          </div>
        </div>
      </div>

      <!-- ── 表单 (可滚动) ── -->
      <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div class="space-y-5">
          <!-- ── 标题 ── -->
          <label class="block">
            <span class="text-muted mb-1.5 block text-xs font-medium">
              标题 <span class="text-destructive">*</span>
            </span>
            <input
              v-model="form.title"
              class="bg-input text-ink focus:border-accent placeholder:text-muted/50 w-full rounded-lg border px-3 py-2 text-sm outline-none"
              placeholder="例如：重构首页响应式布局"
            />
          </label>

          <!-- ── 类型 ── -->
          <div>
            <span class="text-muted mb-1.5 block text-xs font-medium"
              >类型</span
            >
            <div class="flex flex-wrap gap-2">
              <button
                v-for="t in TASK_TYPES"
                :key="t"
                type="button"
                @click="form.type = t"
                class="cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                :class="
                  form.type === t
                    ? typeChipActive(t)
                    : 'text-muted hover:bg-surface'
                "
              >
                {{ t }}
              </button>
            </div>
          </div>

          <!-- ── 优先级 ── -->
          <div>
            <span class="text-muted mb-1.5 block text-xs font-medium"
              >优先级</span
            >
            <div class="flex flex-wrap gap-2">
              <button
                v-for="p in PRIORITIES"
                :key="p"
                type="button"
                @click="form.priority = p"
                class="cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors"
                :class="
                  form.priority === p
                    ? priorityChipActive(p)
                    : 'text-muted hover:bg-surface'
                "
              >
                {{ p }}
              </button>
            </div>
          </div>

          <!-- ── 范围 + 截止日 ── -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <span class="text-muted mb-1.5 block text-xs font-medium"
                >范围
                <span class="text-muted/60 font-normal"
                  >（自由格式 — 例: 前端-React, 后端-Go, AI-LangChain）</span
                ></span
              >
              <input
                v-model="form.scope"
                class="bg-page text-ink focus:border-accent placeholder:text-muted/50 w-full rounded-lg border px-3 py-2 text-sm outline-none"
                placeholder="例如：前端-React"
              />
            </div>
            <label class="block">
              <span class="text-muted mb-1.5 block text-xs font-medium"
                >截止日</span
              >
              <input
                v-model="form.due_date"
                type="date"
                class="bg-page text-ink focus:border-accent w-full cursor-pointer rounded-lg border px-3 py-2 text-sm outline-none"
              />
            </label>
          </div>

          <!-- ── 状态（仅编辑时显示） ── -->
          <div v-if="form.slug">
            <span class="text-muted mb-1.5 block text-xs font-medium"
              >状态</span
            >
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="s in STATUSES"
                :key="s"
                type="button"
                @click="form.status = s"
                class="cursor-pointer rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors"
                :class="
                  form.status === s
                    ? 'border-accent/40 bg-accent/10 text-ink'
                    : 'text-muted hover:bg-surface'
                "
              >
                {{ s }}
              </button>
            </div>
          </div>

          <!-- ── 描述 ── -->
          <label class="block">
            <span class="text-muted mb-1.5 block text-xs font-medium"
              >描述</span
            >
            <textarea
              v-model="form.description"
              rows="3"
              class="bg-page text-ink focus:border-accent placeholder:text-muted/50 w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none"
              placeholder="一两句话说清楚要做什么、为什么..."
            ></textarea>
          </label>

          <!-- ── 详情 ── -->
          <label class="block">
            <span class="text-muted mb-1.5 block text-xs font-medium"
              >详情</span
            >
            <textarea
              v-model="form.detail"
              rows="6"
              class="bg-page text-ink focus:border-accent placeholder:text-muted/50 w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none"
              placeholder="实现思路、参考链接、验收标准等，可较长..."
            ></textarea>
            <span class="text-muted/60 mt-1 block text-[11px]"
              >支持比描述更长的自由文本</span
            >
          </label>

          <!-- ── Spec：验收标准 ── -->
          <label class="block">
            <span class="text-muted mb-1.5 block text-xs font-medium"
              >验收标准
              <span class="text-muted/60 font-normal"
                >（满足这几条算完成 — agent 会逐条自检）</span
              ></span
            >
            <textarea
              v-model="form.acceptance_criteria"
              rows="4"
              class="bg-page text-ink focus:border-accent placeholder:text-muted/50 w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none"
              placeholder="- 所有接口有单测覆盖&#10;- 文档同步更新&#10;- 性能基准不降级"
            ></textarea>
          </label>

          <!-- ── Spec：约束 ── -->
          <label class="block">
            <span class="text-muted mb-1.5 block text-xs font-medium"
              >约束
              <span class="text-muted/60 font-normal"
                >（agent 不可违反的硬性边界）</span
              ></span
            >
            <textarea
              v-model="form.constraints"
              rows="4"
              class="bg-page text-ink focus:border-accent placeholder:text-muted/50 w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none"
              placeholder="- 不动 src/legacy/ 目录&#10;- 后端继续用 Gin，不换框架&#10;- API 响应格式保持不变"
            ></textarea>
          </label>

          <!-- ── Spec：上下文指针 ── -->
          <label class="block">
            <span class="text-muted mb-1.5 block text-xs font-medium"
              >上下文指针
              <span class="text-muted/60 font-normal"
                >（相关代码 / 文档路径，减少 agent 找文件的往返）</span
              ></span
            >
            <textarea
              v-model="form.context_pointers"
              rows="4"
              class="bg-page text-ink focus:border-accent placeholder:text-muted/50 w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none"
              placeholder="internal/auth/, docs/adr/0003, src/middleware/session.ts"
            ></textarea>
          </label>
        </div>
      </div>

      <!-- ── 底部按钮 ── -->
      <div
        class="bg-page flex shrink-0 items-center justify-between border-t px-6 pt-4 pb-5"
      >
        <button
          v-if="form.slug"
          @click="confirmOpen = true"
          class="text-destructive hover:bg-destructive/10 focus-visible:ring-destructive/30 cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          永久删除
        </button>
        <span v-else></span>
        <div class="flex items-center gap-2">
          <button
            @click="emit('close')"
            class="text-muted hover:bg-surface focus-visible:ring-ring cursor-pointer rounded-lg px-3.5 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            取消
          </button>
          <button
            @click="handleSave"
            :disabled="!form.title.trim()"
            class="bg-accent text-ink hover:bg-accent/90 focus-visible:ring-ring cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {{ form.slug ? '保存' : '创建' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 永久删除确认 -->
    <ConfirmDialog
      :open="confirmOpen"
      title="永久删除任务？"
      message="此操作不可撤销，任务将从数据库中彻底移除。"
      confirm-text="永久删除"
      cancel-text="再想想"
      variant="destructive"
      @close="confirmOpen = false"
      @confirm="handleHardDelete"
    />
  </ui-modal>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { Modal as UiModal } from '@/components';
import { ConfirmDialog } from '@/components';
import type {
  CreateDevTaskPayload,
  DevTask,
  DevTaskPriority,
  DevTaskStatus,
  DevTaskType,
  UpdateDevTaskPayload,
} from '@/features/todos/api';
import { PRIORITIES, V3_STATUSES } from '@/features/todos/composables';

const TASK_TYPES: DevTaskType[] = ['问题', '功能需求', '优化', '技术债'];
const STATUSES = V3_STATUSES;

// 类型 chip 激活态颜色（token + opacity，无硬编码 hex）
const TYPE_ACTIVE: Record<DevTaskType, string> = {
  问题: 'border-rose-300/60 bg-rose-50 text-rose-700 dark:border-rose-700/60 dark:bg-rose-950/30 dark:text-rose-400',
  功能需求:
    'border-blue-300/60 bg-blue-50 text-blue-700 dark:border-blue-700/60 dark:bg-blue-950/30 dark:text-blue-400',
  优化: 'border-amber-300/60 bg-amber-50 text-amber-700 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-400',
  技术债:
    'border-purple-300/60 bg-purple-50 text-purple-700 dark:border-purple-700/60 dark:bg-purple-950/30 dark:text-purple-400',
};

// 优先级 chip 激活态：P0 用 destructive 强调，其余走 token
const PRIORITY_ACTIVE: Record<DevTaskPriority, string> = {
  'P0 紧急': 'border-destructive/40 bg-destructive/10 text-destructive',
  'P1 高':
    'border-orange-300/60 bg-orange-50 text-orange-700 dark:border-orange-700/60 dark:bg-orange-950/30 dark:text-orange-400',
  'P2 中': 'border-accent/40 bg-accent/10 text-ink',
  'P3 低': ' bg-surface text-muted',
};

function typeChipActive(t: DevTaskType): string {
  return TYPE_ACTIVE[t] ?? 'border-accent/40 bg-accent/10 text-ink';
}
function priorityChipActive(p: DevTaskPriority): string {
  return PRIORITY_ACTIVE[p] ?? 'border-accent/40 bg-accent/10 text-ink';
}

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

const props = defineProps<{
  open: boolean;
  task: DevTask | null;
}>();

const emit = defineEmits<{
  close: [];
  saveCreate: [payload: CreateDevTaskPayload];
  saveUpdate: [slug: string, payload: UpdateDevTaskPayload];
  hardDelete: [slug: string];
}>();

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

const form = reactive<FormState>(defaultForm());

watch(
  () => props.task,
  (t) => {
    if (t) {
      Object.assign(form, {
        slug: t.slug,
        title: t.title ?? '',
        description: t.description ?? '',
        detail: t.detail ?? '',
        type: t.type,
        priority: t.priority,
        scope: t.scope ?? '',
        status: t.status,
        due_date: t.due_date ?? '',
        acceptance_criteria: t.acceptance_criteria ?? '',
        constraints: t.constraints ?? '',
        context_pointers: t.context_pointers ?? '',
      });
    } else {
      Object.assign(form, defaultForm());
    }
  },
  { immediate: true },
);

function handleSave() {
  if (!form.title.trim()) return;
  const base = {
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    detail: form.detail.trim() || undefined,
    type: form.type,
    priority: form.priority,
    scope: form.scope.trim(),
    due_date: form.due_date || undefined,
    acceptance_criteria: form.acceptance_criteria.trim() || undefined,
    constraints: form.constraints.trim() || undefined,
    context_pointers: form.context_pointers.trim() || undefined,
  };
  if (form.slug) {
    emit('saveUpdate', form.slug, { ...base, status: form.status });
  } else {
    // 新建时 status 由后端默认（待评估），不写入 payload
    emit('saveCreate', base);
  }
}

const confirmOpen = ref(false);

function handleHardDelete() {
  if (!form.slug) return;
  emit('hardDelete', form.slug);
}
</script>
