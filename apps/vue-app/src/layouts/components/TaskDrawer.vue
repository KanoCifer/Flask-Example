<template>
  <!-- Floating trigger button -->
  <Teleport to="body">
    <div class="fixed right-4 bottom-40 z-50">
      <button
        @click="toggle"
        class="group bg-secondary hover:bg-accent flex h-10 cursor-pointer items-center overflow-hidden rounded-full px-2.5 shadow-md transition-all duration-300 ease-out hover:shadow-lg"
        title="开发任务"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="text-ink h-5 w-5 shrink-0 transition-colors duration-300 group-hover:text-white"
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
        <span
          class="max-w-0 min-w-0 text-sm font-medium whitespace-nowrap text-white opacity-0 transition-all duration-300 ease-out group-hover:ml-1.5 group-hover:max-w-20 group-hover:opacity-100"
        >
          任务
        </span>
      </button>
    </div>
  </Teleport>

  <!-- Right drawer -->
  <Teleport to="body">
    <AnimatePresence>
      <motion.div
        v-if="isOpen"
        :initial="{ opacity: 0, x: 40 }"
        :animate="{ opacity: 1, x: 0 }"
        :exit="{ opacity: 0, x: 40 }"
        :transition="SPRING_SNUG"
        class="drawer-panel fixed top-1/2 right-20 z-9999 flex max-w-lg min-w-90 -translate-y-1/2 justify-end rounded-2xl max-sm:right-2 max-sm:min-w-0"
        @click.self="close"
      >
        <div
          class="relative z-10 flex h-[90dvh] w-full flex-col overflow-hidden rounded-2xl"
        >
          <!-- Header：font-serif 标题 + 静默 active 计数 + 关闭键 -->
          <div
            class="border-border flex shrink-0 items-center justify-between border-b px-6 py-4"
          >
            <h3
              class="text-ink flex items-baseline gap-2 font-serif text-lg font-medium tracking-tight"
            >
              开发任务
              <span
                v-if="activeCount"
                class="text-muted bg-surface/10 inline-block min-w-[1.25rem] rounded-full px-1.5 text-center text-[11px] font-medium tabular-nums"
                >{{ activeCount }}</span
              >
            </h3>
            <button
              @click="close"
              class="text-muted hover:bg-surface hover:text-ink focus-visible:ring-ring flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              aria-label="关闭"
            >
              <svg
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-y-auto px-5 py-4">
            <!-- 未登录空状态 -->
            <div
              v-if="!isAuthenticated"
              class="flex h-full min-h-48 flex-col items-center justify-center gap-2 text-center"
            >
              <svg
                class="text-muted/40 h-10 w-10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="1.5"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <p class="text-muted text-sm">请登录后使用</p>
              <Button size="sm" @click="handleLogin"> 去登录 </Button>
            </div>

            <!-- 已登录后的可交互内容 -->
            <div v-else>
              <!-- Collapsed add button：与 section header 同款 sentence-case 按钮 -->
              <button
                v-if="!showAddForm"
                @click="showAddForm = true"
                class="add-shell text-muted hover:text-ink hover:border-accent/40 mb-6 flex w-full cursor-pointer items-center gap-2 rounded-xl border border-dashed px-3.5 py-2.5 text-sm transition-colors"
              >
                <svg
                  class="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                添加任务…
              </button>

              <!-- Expanded add form：和 section 行卡片同 surface 质感 -->
              <div v-else class="add-shell mb-6 rounded-xl border px-4 py-3.5">
                <input
                  ref="addTitleInput"
                  v-model="newTaskForm.title"
                  type="text"
                  placeholder="任务标题…"
                  class="placeholder:text-muted/50 text-ink bg-surface focus:border-accent w-full rounded-lg border px-3 py-2 text-sm font-medium outline-none"
                  @keydown.enter="submitCreateTask"
                />
                <div class="mt-3 space-y-3">
                  <textarea
                    v-model="newTaskForm.description"
                    placeholder="描述… (可选)"
                    rows="3"
                    class="bg-surface focus:border-accent placeholder:text-muted/50 text-ink w-full resize-none rounded-lg border p-2.5 text-sm outline-none"
                  ></textarea>
                  <div class="flex flex-wrap items-center gap-2">
                    <select
                      v-model="newTaskForm.type"
                      class="bg-surface text-ink cursor-pointer rounded-lg border px-3 py-1.5 text-sm outline-none"
                    >
                      <option v-for="t in TASK_TYPES" :key="t" :value="t">
                        {{ t }}
                      </option>
                    </select>
                    <select
                      v-model="newTaskForm.priority"
                      class="bg-surface text-ink cursor-pointer rounded-lg border px-3 py-1.5 text-sm outline-none"
                    >
                      <option v-for="p in PRIORITIES" :key="p" :value="p">
                        {{ p }}
                      </option>
                    </select>
                  </div>
                  <div class="flex items-center gap-2">
                    <input
                      v-model="newTaskForm.due_date"
                      type="date"
                      class="bg-surface text-ink cursor-pointer rounded-lg border px-3 py-1.5 text-sm outline-none"
                    />
                    <div class="ml-auto flex gap-2">
                      <button
                        @click="cancelAdd"
                        class="bg-surface text-ink hover:bg-surface/80 cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                      >
                        取消
                      </button>
                      <button
                        @click="submitCreateTask"
                        :disabled="!newTaskForm.title.trim()"
                        class="bg-accent text-ink hover:bg-accent/90 cursor-pointer rounded-lg px-4 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        添加
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Status sections：与 FrontierPanel / ReviewPanel 同款 lockup -->
              <div v-for="section in sections" :key="section.key" class="mb-7">
                <header class="mb-2.5 flex items-baseline justify-between">
                  <div class="flex items-baseline gap-2">
                    <h4
                      class="text-ink font-serif text-base font-medium tracking-tight"
                    >
                      {{ section.title }}
                    </h4>
                    <span
                      v-if="section.tasks.length"
                      class="bg-surface/10 text-muted inline-block min-w-[1.25rem] rounded-full px-1.5 text-center text-[11px] font-medium tabular-nums"
                    >
                      {{ section.tasks.length }}
                    </span>
                  </div>
                  <span class="text-muted text-xs">
                    {{ sectionSubtitle(section.key) }}
                  </span>
                </header>

                <TransitionGroup
                  tag="div"
                  class="space-y-2"
                  enter-active-class="transition-all duration-300 ease-out"
                  enter-from-class="opacity-0 translate-y-2"
                  enter-to-class="opacity-100 translate-y-0"
                  leave-active-class="transition-all duration-200 ease-out"
                  leave-from-class="opacity-100 scale-100"
                  leave-to-class="opacity-0 scale-95"
                  move-class="transition-transform duration-300"
                >
                  <DrawerTaskCard
                    v-for="task in section.tasks"
                    :key="task.id"
                    :task="task"
                    :done="section.key === 'done'"
                    @open="(slug) => $emit('open-task', slug)"
                    @cycle-status="store.cycleStatus"
                    @delete-task="store.deleteTask"
                  />
                </TransitionGroup>

                <p
                  v-if="section.tasks.length === 0"
                  class="text-muted/60 py-4 text-center text-xs"
                >
                  {{ section.emptyText }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  </Teleport>
</template>

<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v';
import { SPRING_SNUG } from '@/constants';
import {
  DrawerTaskCard,
  useV3DevTaskStore,
  useTaskDrawer,
  useDevTaskSections,
  PRIORITIES,
} from '@/features/todos';
import type {
  DevTaskPriority,
  DevTaskSection,
  DevTaskType,
} from '@/features/todos';
import { storeToRefs } from 'pinia';
import { computed, onMounted, ref } from 'vue';
import { useAuthStore } from '@/features/auth';
import { Button } from '@/components';

const TASK_TYPES: DevTaskType[] = ['功能需求', '问题', '优化', '技术债'];

// 各 section 的右侧 italic 小字副标题 —— 与 FrontierPanel / ReviewPanel 同款 lockup。
const SECTION_SUBTITLE: Record<DevTaskSection['key'], string> = {
  'in-progress': '正在推进',
  upcoming: '按优先级排序',
  done: '最近关闭',
};
const sectionSubtitle = (key: DevTaskSection['key']) =>
  SECTION_SUBTITLE[key] ?? '';

const emit = defineEmits<{
  requestLogin: [];
  'open-task': [slug: string];
}>();

const authStore = useAuthStore();
const isAuthenticated = computed(() => authStore.isAuthenticated);

const store = useV3DevTaskStore();
const { tasks } = storeToRefs(store);

const { isOpen, close, toggle } = useTaskDrawer();
const { activeCount, sections } = useDevTaskSections(tasks);

function handleLogin() {
  close();
  emit('requestLogin');
}

// 新建表单（折叠态）
const showAddForm = ref(false);
const addTitleInput = ref<HTMLInputElement | null>(null);

const newTaskForm = ref({
  title: '',
  description: '',
  due_date: '',
  type: '功能需求' as DevTaskType,
  priority: 'P2 中' as DevTaskPriority,
});

const submitCreateTask = async () => {
  if (!newTaskForm.value.title.trim()) return;
  await store.createTask({
    title: newTaskForm.value.title.trim(),
    description: newTaskForm.value.description.trim() || undefined,
    due_date: newTaskForm.value.due_date || undefined,
    type: newTaskForm.value.type,
    priority: newTaskForm.value.priority,
    scope: '',
  });
  newTaskForm.value = {
    title: '',
    description: '',
    due_date: '',
    type: '功能需求',
    priority: 'P2 中',
  };
  showAddForm.value = false;
};

const cancelAdd = () => {
  newTaskForm.value = {
    title: '',
    description: '',
    due_date: '',
    type: '功能需求',
    priority: 'P2 中',
  };
  showAddForm.value = false;
};

onMounted(() => {
  // 未登录时不请求 devtask：避免 devtaskRequest 拦截器反复打 v3/dev-task/token 形成循环
  if (isAuthenticated.value) {
    store.fetchTasks();
  }
});
</script>

<style lang="scss" scoped>
/* 抽屉面板：layered ambient + 顶部 inset 高光 = 「台灯下的纸」。
   shadow 全部走 color-mix(in oklch, var(--ink) N%, transparent)，跟随主题自适应。 */
.drawer-panel {
  background-color: var(--color-page);
  border: 1px solid color-mix(in oklch, var(--ink) 10%, transparent);
  box-shadow:
    0 1px 1px color-mix(in oklch, var(--ink) 6%, transparent),
    0 6px 14px color-mix(in oklch, var(--ink) 10%, transparent),
    0 18px 32px color-mix(in oklch, var(--ink) 8%, transparent),
    inset 0 1px 0 0 oklch(from var(--page) l c h / 0.6);
}

/* 新建任务折叠/展开：弱化为虚线 surface，不抢 section 主线的注意力。 */
.add-shell {
  background-color: color-mix(in oklch, var(--page) 60%, transparent);
  box-shadow: inset 0 1px 0 0 oklch(from var(--page) l c h / 0.5);
}

@media (prefers-reduced-motion: reduce) {
  /* TransitionGroup 已用 transition-all；这里给 reduce-motion 用户直接落位 */
  .drawer-panel,
  .add-shell {
    transition: none;
  }
}
</style>
