<template>
  <div class="bg-page flex min-h-screen w-full flex-col">
    <!-- ── page header ── -->
    <TodoHeader @create="openCreate" @mcp-token="mcpTokenOpen = true" />

    <!-- ── main content ── -->
    <div class="grid flex-1 grid-cols-[auto_1fr]">
      <TodoSidebar v-model="activeTab" v-model:collapsed="sidebarCollapsed" />

      <main class="min-w-0 overflow-y-auto px-5 py-5 sm:px-8">
        <!-- mobile tab strip (in flow, below sticky header, clear of floating nav) -->
        <TodoMobileTabs v-model="activeTab" />

        <!-- 未登录空状态 -->
        <div
          v-if="!isAuthenticated"
          class="flex h-full min-h-96 flex-col items-center justify-center gap-3 text-center"
        >
          <svg
            class="text-muted/40 h-14 w-14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </svg>
          <p class="text-ink text-lg font-medium">请登录后使用开发任务</p>
          <p class="text-muted max-w-xs text-sm">
            开发任务看板用于管理个人的开发任务，需登录后启用。
          </p>
          <UiButton class="mt-1 px-5 py-2" @click="$router.push('/login')">
            去登录
          </UiButton>
        </div>

        <!-- 加载态 -->
        <div v-else-if="store.loading" class="space-y-3">
          <div class="bg-surface h-8 w-40 animate-pulse rounded-md" />
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="n in 3"
              :key="n"
              class="bg-surface h-28 animate-pulse rounded-xl"
            />
          </div>
        </div>

        <template v-else>
          <!-- Tab 内容：单 keyed 元素 + mode="out-in"，确保每次切换是
               一次干净的 enter/leave，不会多面板同时参与过渡。 -->
          <SlideFadeTransition>
            <component
              :is="activePanel"
              :key="activeTab"
              @open="openDetail"
              @cycle="store.cycleStatus"
              @delete="handleDelete"
            />
          </SlideFadeTransition>
        </template>
      </main>
    </div>

    <!-- ── create / edit modal ── -->
    <DevTaskModal
      :open="modalOpen"
      :task="editingTask"
      @close="modalOpen = false"
      @save-create="handleCreate"
      @save-update="handleUpdate"
      @hard-delete="handleHardDelete"
    />

    <!-- ── detail slide-out panel ── -->
    <TaskDetailPanel
      :open="detailOpen"
      :task="detailTask"
      @close="detailOpen = false"
      @set-status="handleSetStatus"
      @edit="openEdit"
      @delete="handleDelete"
    />

    <!-- ── MCP token ── -->
    <McpTokenModal :open="mcpTokenOpen" @close="mcpTokenOpen = false" />

    <!-- ── soft delete confirm ── -->
    <ConfirmDialog
      :open="deleteConfirmOpen"
      title="删除任务？"
      message="任务将被标记为已删除，可从后端恢复。"
      confirm-text="删除"
      cancel-text="取消"
      variant="default"
      @close="deleteConfirmOpen = false"
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import DevTaskModal from './components/DevTaskModal.vue';
import {
  Button as UiButton,
  ConfirmDialog,
  SlideFadeTransition,
} from '@/components';
import { useV3DevTaskStore } from '@/features/todos/stores/v3devtasks';
import { useAuthStore } from '@/features/auth';
import type { DevTask } from '@/features/todos/api';
import McpTokenModal from './components/McpTokenModal.vue';
import TaskDetailPanel from './components/TaskDetailPanel.vue';
import FrontierPanel from './components/FrontierPanel.vue';
import PlanningPanel from './components/PlanningPanel.vue';
import ReviewPanel from './components/ReviewPanel.vue';
import KanbanPanel from './components/KanbanPanel.vue';
import TodoSidebar from './components/TodoSidebar.vue';
import TodoHeader from './components/TodoHeader.vue';
import TodoMobileTabs from './components/TodoMobileTabs.vue';
import type { Component } from 'vue';

const authStore = useAuthStore();
const isAuthenticated = computed(() => authStore.isAuthenticated);

const store = useV3DevTaskStore();

// ── tab state ──
type TabId = 'frontier' | 'planning' | 'review' | 'kanban';
const activeTab = ref<TabId>('frontier');

// ── sidebar 折叠状态（持久化到 localStorage） ──
// 刷新页面或重进站点时保留用户偏好；try/catch 容错隐私模式/SSR。
const SIDEBAR_COLLAPSED_KEY = 'todos:sidebar-collapsed';
const sidebarCollapsed = ref(false);

onMounted(() => {
  try {
    sidebarCollapsed.value =
      localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    // localStorage 不可用；保留默认展开
  }
});

watch(sidebarCollapsed, (v) => {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, v ? '1' : '0');
  } catch {
    // 写入失败静默忽略
  }
});

// 当前激活的 tab 面板组件（单 keyed 节点供 <Transition mode="out-in"> 切换）
const activePanel = computed((): Component => {
  if (activeTab.value === 'planning') return PlanningPanel;
  if (activeTab.value === 'review') return ReviewPanel;
  if (activeTab.value === 'kanban') return KanbanPanel;
  return FrontierPanel;
});

// ── modal state ──
const modalOpen = ref(false);
const editingTask = ref<DevTask | null>(null);
const mcpTokenOpen = ref(false);

function openCreate() {
  editingTask.value = null;
  modalOpen.value = true;
}
function openEdit(slug: string) {
  editingTask.value = store.tasks.find((t) => t.slug === slug) ?? null;
  detailOpen.value = false;
  modalOpen.value = true;
}
async function handleCreate(payload: Parameters<typeof store.createTask>[0]) {
  const task = await store.createTask(payload);
  if (task) modalOpen.value = false;
}
async function handleUpdate(
  slug: string,
  patch: Parameters<typeof store.updateTask>[1],
) {
  const ok = await store.updateTask(slug, patch);
  if (ok) modalOpen.value = false;
}
async function handleHardDelete(slug: string) {
  await store.hardDeleteTask(slug);
  modalOpen.value = false;
}

// ── detail panel state ──
const detailOpen = ref(false);
const detailTask = ref<DevTask | null>(null);

function openDetail(slug: string) {
  detailTask.value = store.tasks.find((t) => t.slug === slug) ?? null;
  detailOpen.value = true;
}
async function handleSetStatus(slug: string, status: DevTask['status']) {
  await store.updateTask(slug, { status });
  // refresh local ref so panel re-renders
  detailTask.value = store.tasks.find((t) => t.slug === slug) ?? null;
}

// ── delete confirm ──
const deleteConfirmOpen = ref(false);
const pendingDeleteSlug = ref<string | null>(null);

function handleDelete(slug: string) {
  pendingDeleteSlug.value = slug;
  deleteConfirmOpen.value = true;
}
async function confirmDelete() {
  const slug = pendingDeleteSlug.value;
  deleteConfirmOpen.value = false;
  pendingDeleteSlug.value = null;
  if (slug) await store.deleteTask(slug);
}

onMounted(() => {
  // 未登录时不请求 devtask，避免拦截器反复打 v3/dev-task/token 形成循环
  if (isAuthenticated.value) {
    store.fetchTasks();
  }
});
</script>
