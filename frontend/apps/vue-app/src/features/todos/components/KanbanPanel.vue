<template>
  <div class="flex flex-col gap-4">
    <!-- ── 顶部筛选栏 ── -->
    <TodoFilterBar
      :filter-type="filterType"
      :filter-priority="filterPriority"
      :filter-member="filterMember"
      :member-chips="memberChips"
      v-model:search-term="searchTerm"
      :count="visibleTasks.length"
      @toggle="(p) => toggleFilter(p.key, p.value)"
    />

    <!-- ── 四列看板 ── -->
    <div
      class="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-4"
      role="list"
      aria-label="开发任务看板"
    >
      <KanbanColumn
        v-for="col in KANBAN_COLUMNS"
        :key="col.id"
        :column="col"
        :lanes="lanesFor(col.id)"
        :dragged-slug="draggedSlug"
        :drag-over="dragOverColumn === col.id"
        :total-count="columnCount(col.id)"
        @open="$emit('open', $event)"
        @cycle="$emit('cycle', $event)"
        @delete="$emit('delete', $event)"
        @dragstart="onDragStart"
        @dragend="onDragEnd"
        @dragover="onDragOver(col.id)"
        @dragleave="onDragLeave(col.id)"
        @drop="onDrop(col.id)"
      />
    </div>
  </div>
</template>

<script lang="ts">
// ── 看板列定义 —— 迁移到 devTaskPolicy（与 buildDevTaskView 同源），这里只 re-export
// 以保持外部 `import { KANBAN_COLUMNS } from '@/features/todos/components/KanbanPanel.vue'`
// 这类旧调用方继续工作。
export {
  KANBAN_COLUMNS,
  type KanbanColumnId,
  type KanbanColumn,
} from '@/features/todos/composables/devTaskPolicy';
</script>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useV3DevTaskStore } from '@/features/todos/stores/v3devtasks';
import type {
  DevTask,
  DevTaskPriority,
  DevTaskType,
} from '@/features/todos/api';
import KanbanColumn from './KanbanColumn.vue';
import TodoFilterBar, { type MemberChip } from './TodoFilterBar.vue';
import { KANBAN_COLUMNS, type KanbanColumnId } from '@/features/todos/composables/devTaskPolicy';

const store = useV3DevTaskStore();

const filterType = ref<Set<DevTaskType>>(new Set());
const filterPriority = ref<Set<DevTaskPriority>>(new Set());
const filterMember = ref<Set<number>>(new Set());
const searchTerm = ref('');

// ── 拖拽状态 ──
const draggedSlug = ref<string | null>(null);
const dragOverColumn = ref<KanbanColumnId | null>(null);

function onDragStart(slug: string) {
  draggedSlug.value = slug;
}
function onDragEnd() {
  draggedSlug.value = null;
  dragOverColumn.value = null;
}
function onDragOver(col: KanbanColumnId) {
  if (dragOverColumn.value !== col) dragOverColumn.value = col;
}
function onDragLeave(col: KanbanColumnId) {
  // 只在真正离开列区域时清空，避免子元素冒泡造成的闪烁
  if (dragOverColumn.value === col) dragOverColumn.value = null;
}
async function onDrop(col: KanbanColumnId) {
  const slug = draggedSlug.value;
  dragOverColumn.value = null;
  draggedSlug.value = null;
  if (!slug) return;

  const column = KANBAN_COLUMNS.find((c) => c.id === col);
  if (!column) return;

  const task = store.tasks.find((t) => t.slug === slug);
  if (!task) return;

  // 同列内拖动：顺序同步暂不处理（按需求"先不管顺序更新"），仅放空。
  // 视觉上仍会有 drop 高亮，但本地 sort_order 不变，所以位置看起来不变。
  if (column.statuses.includes(task.status)) return;

  // 跨列：直接调 store.updateTask PATCH 状态变更。
  // 它内部已经做"先打后端 → 成功则本地乐观更新 / 失败则报错"，无需手动改 store.tasks。
  // 注意"待办"列是待评估 ∪ 待排期的合并视图，column.targetStatus 固定为 '待评估'，
  // 与 STATUS_CYCLE 的起点一致 —— 跨列拖到"待办"的任务会以'待评估'落地。
  await store.updateTask(slug, { status: column.targetStatus });
}

// ── 筛选 / 成员聚合 ──
function toggleFilter(
  key: 'type' | 'priority' | 'member',
  val: DevTaskType | DevTaskPriority | number,
) {
  if (key === 'type') {
    const v = val as DevTaskType;
    const s = filterType.value;
    if (s.has(v)) s.delete(v);
    else s.add(v);
  } else if (key === 'priority') {
    const v = val as DevTaskPriority;
    const s = filterPriority.value;
    if (s.has(v)) s.delete(v);
    else s.add(v);
  } else {
    const v = val as number;
    const s = filterMember.value;
    if (s.has(v)) s.delete(v);
    else s.add(v);
  }
}

// 全部走 store.derived —— per-field computed 包一层。
// 不要用 toRefs(store.derived) —— 见 FrontierPanel 那条注释。
const liveTasks = computed(() => store.derived.live);
const userTaskCounts = computed(() => store.derived.userTaskCounts);
const derivedColumnCounts = computed(() => store.derived.columnCounts);
const derivedSwimlanes = computed(() => store.derived.swimlanesByColumn);

/** 成员 chip —— 直接复用 derived.userTaskCounts，不再自己 filter。 */
const memberChips = computed<MemberChip[]>(() =>
  Array.from(userTaskCounts.value.entries())
    .sort(
      (a: [number, number], b: [number, number]) => b[1] - a[1],
    )
    .map(([userId, count]) => ({
      userId,
      label: `用户 ${userId}`,
      count,
    })),
);

/** 看板本地的可见任务 —— 只在 derived.live 之上套 panel 自己的筛选条件。
 *  is_deleted 已由 derived.live 滤过，这里不再重复 filter。 */
const visibleTasks = computed<DevTask[]>(() => {
  const q = searchTerm.value.trim().toLowerCase();
  const ts = filterType.value;
  const ps = filterPriority.value;
  const ms = filterMember.value;
  const hasQ = q.length > 0;
  const out: DevTask[] = [];
  for (const t of liveTasks.value) {
    if (ts.size && !ts.has(t.type)) continue;
    if (ps.size && !ps.has(t.priority)) continue;
    if (ms.size && !ms.has(t.user_id)) continue;
    if (hasQ && !(t.title ?? '').toLowerCase().includes(q)) continue;
    out.push(t);
  }
  return out;
});

/** 各列泳道 —— 复用 derived.swimlanesByColumn，不在本 panel 套筛选。
 *  （原行为：筛选只影响 TodoFilterBar 的 count，泳道展示全量。）
 */
interface LaneVM {
  userId: number;
  label: string;
  tasks: DevTask[];
}

const columnsById = computed<Map<KanbanColumnId, LaneVM[]>>(() => {
  const out = new Map<KanbanColumnId, LaneVM[]>();
  for (const col of KANBAN_COLUMNS) {
    out.set(col.id, derivedSwimlanes.value.get(col.id) ?? []);
  }
  return out;
});

function columnCount(col: KanbanColumnId): number {
  return derivedColumnCounts.value.get(col) ?? 0;
}

function lanesFor(col: KanbanColumnId): LaneVM[] {
  return columnsById.value.get(col) ?? [];
}

defineEmits<{
  open: [slug: string];
  cycle: [slug: string];
  delete: [slug: string];
}>();
</script>