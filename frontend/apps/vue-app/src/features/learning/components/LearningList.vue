<!--
  LearningList — /learning 入口页.

  视觉契约:
   - 顶部"扉页":标题 + 一段引领句,整张置于圆角 2xl + soft shadow 的 card 中。
   - 主题输入:位于同一张 card 内部,bottom-bordered 输入框 + pill 化 CTA。
   - 下方"我的学习"目录:每条记录是一张圆角 2xl 卡片,hover 时阴影抬升。
   - 保持所有测试可见文案与 aria 语义。

  行为契约:
   - 主题输入框 + "生成课程" 按钮:点击提交后进入"生成中"态,后端生成
     是异步的,前端轮询 ready 后 router.push 到 /learning/course/:courseId。
   - "我的学习" 区块:列出当前 owner 的所有进度项(topic、已完成 session、
     练习状态、下一节)。点 "继续学习" 跳到对应 session;已全部完成的展示
     "已完成" 徽标。
   - 匿名友好:无登录墙;owner key 由 getAnonId() 持有。
-->
<script setup lang="ts">
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  Loader2,
  RotateCcw,
  Sparkles,
} from '@lucide/vue';
import { useMediaQuery } from '@vueuse/core';
import { motion } from 'motion-v';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button, HoverDropdown } from '@/components';
import { useAuthStore } from '@/features/auth';
import { EASE } from '@/constants/motionPresets';
import { useLearningCourse } from '@/features/learning/composables/useLearningCourse';
import type { LearningProgressItem } from '@/features/learning/types';

defineOptions({ name: 'LearningList' });

const router = useRouter();
const auth = useAuthStore();
const {
  submitting,
  error,
  progressList,
  progressLoading,
  models,
  submitTopic,
  loadProgress,
  loadModels,
  clearError,
} = useLearningCourse();

/** 输入框的本地状态(同步到 composable.topic 也行,这里保留本地草稿)。 */
const draft = ref('');
/** 学习目标(可选)的本地草稿。 */
const goalDraft = ref('');
/** 选中的模型 id（task-391）。默认指向首项（一般是 flash）；若列表为空则为空串。 */
const modelDraft = ref('');
/** 附加提示词（task-391）的本地草稿，trim 后提交。 */
const extraPromptDraft = ref('');

/** 主题 / 目标 / 附加提示 三个输入框共享的基座样式（宽度差异经 :class 拼接）。 */
const inputCls =
  'text-ink placeholder-muted bg-surface/60 focus-visible:ring-ring rounded-full px-5 py-2.5 text-sm shadow-sm transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-60';

/** 当前选中模型条目（找不到则回退到列表第一项）。 */
const selectedModel = computed(
  () =>
    models.value.find((m) => m.id === modelDraft.value) ?? models.value[0] ?? null,
);

/** 当前模型下拉是否可交互（只要列表非空就算可下拉）。 */
const modelOptionsDisabled = computed(() => models.value.length === 0);

/** trigger 是否要禁用某个特定选项：premium 模型仅登录用户可选。 */
function isOptionDisabled(modelIsPremium: boolean): boolean {
  return modelIsPremium && !auth.isAuthenticated;
}

/** 触发生成;ready 后跳转。 */
async function onGenerate() {
  const t = draft.value.trim();
  if (!t) return;
  try {
    const { course_id } = await submitTopic(t, goalDraft.value, {
      modelId: modelDraft.value || undefined,
      extraPrompt: extraPromptDraft.value,
    });
    // 跳转前清掉草稿,这样回到首页不会看到残留文本
    draft.value = '';
    goalDraft.value = '';
    extraPromptDraft.value = '';
    // 模型 id 保留为用户偏好;不重置,这样反复生成时不必每次重新选。
    await router.push({
      name: 'learning-course',
      params: { courseId: course_id },
    });
  } catch {
    // error 已在 composable 内写入,UI 自动展示
  }
}

/** 进度项 → 继续学习;若无 next_session(全完成)就不跳。 */
function onContinue(item: LearningProgressItem) {
  if (item.next_session === null) return;
  void router.push({
    name: 'learning-course',
    params: { courseId: item.course_id },
    // 后续可用 query.hash 锚定 session,目前先落到课程详情顶部即可
    query: { session: String(item.next_session) },
  });
}

function refreshProgress() {
  void loadProgress();
}

/** prefers-reduced-motion:开启时禁用入场动画。 */
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

onMounted(() => {
  void loadProgress();
  void loadModels().then(() => {
    // 首屏兜底:列表就绪后若 draft 仍空,默认选第一条（一般是 flash）。
    if (!modelDraft.value && models.value.length > 0) {
      modelDraft.value = models.value[0].id;
    }
  });
});

function statusLabel(item: LearningProgressItem): string {
  if (item.status === 'pending') return '生成中…';
  if (item.status === 'failed') return '生成失败';
  if (item.next_session === null) return '已完成';
  if (item.sessions_done.length === 0) return '未开始';
  return `已完成 ${item.sessions_done.length} 节`;
}
</script>

<template>
  <main class="bg-page min-h-screen w-full">
    <div class="mx-auto w-full max-w-3xl px-5 py-10 sm:py-20">
      <!-- 扉页卡片 -->
      <section class="bg-card rounded-2xl px-6 py-8 shadow-md sm:px-8 sm:py-10">
        <header class="mb-8">
          <p
            class="text-muted bg-surface/70 mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono text-[11px] tracking-[0.18em] uppercase shadow-sm"
          >
            <BookOpen class="h-3 w-3" aria-hidden="true" />
            learning · v2
          </p>
          <h1
            class="text-ink font-serif text-3xl leading-tight font-medium tracking-tight sm:text-4xl"
          >
            What do you wanna learn?
          </h1>
          <p class="text-muted mt-3 max-w-xl text-sm leading-relaxed">
            输入一个主题,生成一份专属于你的课程 —— 讲义、资源、练习。
          </p>
        </header>

        <!-- 主题输入：主角,基线 -->
        <div class="mb-6">
          <label
            for="learning-topic"
            class="text-muted mb-2 block font-mono text-[11px] tracking-[0.18em] uppercase"
          >
            主题
          </label>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3">
            <input
              id="learning-topic"
              v-model="draft"
              type="text"
              :disabled="submitting"
              placeholder="康德《纯粹理性批判》的先验演绎"
              maxlength="120"
              :class="[inputCls, 'flex-1']"
              @keydown.enter="onGenerate"
            />
            <Button
              size="md"
              :disabled="!draft.trim() || submitting"
              class="shrink-0"
              @click="onGenerate"
            >
              <Loader2
                v-if="submitting"
                class="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              <span class="font-mono">{{
                submitting ? '生成中…' : '生成课程'
              }}</span>
              <ArrowRight
                v-if="!submitting"
                class="h-3.5 w-3.5"
                aria-hidden="true"
              />
            </Button>
          </div>

          <label
            for="learning-goal"
            class="text-muted mt-6 mb-2 block font-mono text-[11px] tracking-[0.18em] uppercase"
          >
            学习目标 (可选)
          </label>
          <input
            id="learning-goal"
            v-model="goalDraft"
            type="text"
            :disabled="submitting"
            placeholder="能独立复述先验演绎的论证结构,并完成 5 道自测题"
            maxlength="200"
            :class="[inputCls, 'w-full']"
            @keydown.enter="onGenerate"
          />

          <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-3">
            <div class="flex-1">
              <label
                class="text-muted mb-2 block font-mono text-[11px] tracking-[0.18em] uppercase"
              >
                模型
              </label>
              <HoverDropdown
                :panel-class="
                  'bg-card border-border absolute top-full left-0 z-30 mt-2 w-full min-w-[14rem] rounded-2xl border p-1.5 shadow-lg backdrop-blur-xs'
                "
                class="relative block w-full"
              >
                <template #trigger="{ isOpen }">
                  <button
                    type="button"
                    :aria-expanded="isOpen || undefined"
                    aria-haspopup="listbox"
                    :disabled="modelOptionsDisabled || submitting"
                    class="text-ink bg-surface/60 focus-visible:ring-ring flex w-full items-center justify-between rounded-full px-5 py-2.5 text-sm shadow-sm transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span class="inline-flex items-center gap-2 truncate">
                      <Sparkles
                        v-if="selectedModel"
                        class="text-accent h-3.5 w-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span class="truncate">
                        {{ selectedModel?.label ?? '加载中…' }}
                      </span>
                      <span
                        v-if="selectedModel?.is_premium"
                        class="bg-accent/15 text-accent rounded-full px-1.5 py-0.5 font-mono text-[10px] tracking-[0.12em] uppercase"
                      >
                        PRO
                      </span>
                    </span>
                    <ChevronDown
                      class="text-muted h-3.5 w-3.5 shrink-0 transition-transform duration-150"
                      :class="{ 'rotate-180': isOpen }"
                      aria-hidden="true"
                    />
                  </button>
                </template>
                <template #default="{ close }">
                  <ul
                    role="listbox"
                    aria-label="选择学习模型"
                    class="flex flex-col gap-0.5"
                  >
                    <li
                      v-for="m in models"
                      :key="m.id"
                      role="option"
                      :aria-selected="m.id === modelDraft"
                      :aria-disabled="isOptionDisabled(m.is_premium) || undefined"
                    >
                      <button
                        type="button"
                        :disabled="isOptionDisabled(m.is_premium)"
                        :title="
                          isOptionDisabled(m.is_premium)
                            ? '登录后解锁'
                            : undefined
                        "
                        class="text-ink hover:bg-surface/70 flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-card focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        :class="{
                          'font-medium underline decoration-accent decoration-2 underline-offset-4':
                            m.id === modelDraft,
                        }"
                        @click="
                          () => {
                            if (isOptionDisabled(m.is_premium)) return;
                            modelDraft = m.id;
                            close();
                          }
                        "
                      >
                        <span class="inline-flex items-center gap-2 truncate">
                          <Sparkles
                            class="text-accent h-3.5 w-3.5 shrink-0"
                            aria-hidden="true"
                          />
                          <span class="truncate">{{ m.label }}</span>
                        </span>
                        <span
                          v-if="m.is_premium"
                          class="bg-accent/15 text-accent rounded-full px-1.5 py-0.5 font-mono text-[10px] tracking-[0.12em] uppercase"
                        >
                          PRO
                        </span>
                      </button>
                    </li>
                  </ul>
                </template>
              </HoverDropdown>
            </div>
          </div>

          <label
            for="learning-extra-prompt"
            class="text-muted mt-6 mb-2 block font-mono text-[11px] tracking-[0.18em] uppercase"
          >
            补充要求 (可选)
          </label>
          <input
            id="learning-extra-prompt"
            v-model="extraPromptDraft"
            type="text"
            :disabled="submitting"
            placeholder="例如:面向初学者,优先讲解入门概念,避免抽象数学符号"
            maxlength="200"
            :class="[inputCls, 'w-full']"
            @keydown.enter="onGenerate"
          />

          <p
            v-if="error"
            class="text-ink bg-destructive/10 mt-4 rounded-full px-4 py-2 text-xs leading-relaxed shadow-sm"
          >
            {{ error }}
            <button
              type="button"
              class="text-muted hover:text-ink ml-2 underline-offset-2 hover:underline"
              @click="clearError"
            >
              知道了
            </button>
          </p>
          <p class="text-muted mt-4 text-xs leading-relaxed">
            课程生成约需 1-3 分钟,生成完成后会自动跳转到课程详情页。
          </p>
        </div>
      </section>

      <!-- 我的学习：编号目录 -->
      <section class="mt-10">
        <div class="mb-4 flex items-center justify-between px-1">
          <h2
            class="text-ink font-mono text-[11px] tracking-[0.18em] uppercase"
          >
            我的课程
          </h2>
          <button
            type="button"
            class="text-muted hover:text-ink focus-visible:ring-ring bg-card focus-visible:ring-offset-page inline-flex items-center gap-1 rounded-full px-3 py-1 font-mono text-[11px] tracking-[0.18em] uppercase shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            :disabled="progressLoading"
            @click="refreshProgress"
          >
            <RotateCcw
              class="h-3 w-3"
              :class="
                progressLoading ? 'animate-spin motion-reduce:animate-none' : ''
              "
              aria-hidden="true"
            />
            刷新
          </button>
        </div>

        <!-- Loading -->
        <div
          v-if="progressLoading && progressList.length === 0"
          class="space-y-3"
        >
          <div
            v-for="n in 2"
            :key="n"
            class="bg-card h-20 animate-pulse rounded-2xl shadow-sm"
          />
        </div>

        <!-- Empty -->
        <div
          v-else-if="progressList.length === 0"
          class="bg-card text-muted rounded-2xl px-6 py-10 text-center text-sm shadow-sm"
        >
          还没有学习记录。输入主题开始你的第一门课。
        </div>

        <!-- Items -->
        <ol v-else class="space-y-3">
          <motion.li
            v-for="(item, idx) in progressList"
            :key="item.course_id"
            :initial="reducedMotion ? false : { opacity: 0, y: 8, filter: 'blur(4px)' }"
            :animate="reducedMotion ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }"
            :transition="{ ...EASE, delay: 0.5 + idx * 0.06, type: 'spring' }"
          >
            <div
              class="bg-card hover:shadow-accent/10 flex items-center gap-4 rounded-2xl px-5 py-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
            >
              <span
                class="bg-surface/60 text-ink inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-xs font-medium tabular-nums shadow-inner"
                aria-hidden="true"
              >
                {{ String(idx + 1).padStart(3, '0') }}
              </span>
              <div class="min-w-0 flex-1">
                <h3 class="text-ink truncate text-sm font-medium">
                  {{ item.topic }}
                </h3>
                <p
                  class="text-muted mt-1 flex items-center gap-1.5 font-mono text-[11px] font-medium tracking-[0.12em] uppercase"
                  :class="{ 'text-accent': item.status === 'pending' }"
                >
                  <Loader2
                    v-if="item.status === 'pending'"
                    class="h-3 w-3 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  <span>{{ statusLabel(item) }}</span>
                  <span v-if="item.exercise_done" class="text-ink ml-1">
                    · 练习已完成
                  </span>
                </p>
              </div>
              <button
                v-if="item.status === 'pending'"
                type="button"
                class="bg-accent/20 text-accent cursor-not-allowed inline-flex shrink-0 items-center gap-1 rounded-full px-4 py-1.5 font-mono text-[11px] font-medium tracking-[0.18em] uppercase shadow-sm"
                disabled
              >
                <Loader2
                  class="h-3 w-3 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
                生成中…
              </button>
              <button
                v-else-if="item.next_session !== null"
                type="button"
                class="bg-accent text-contrast hover:bg-accent/90 focus-visible:ring-ring shadow-accent/30 focus-visible:ring-offset-card inline-flex shrink-0 items-center gap-1 rounded-full px-4 py-1.5 font-mono text-[11px] font-medium tracking-[0.18em] uppercase shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                @click="onContinue(item)"
              >
                <BookOpen class="h-3 w-3" aria-hidden="true" />
                <span>继续学习 →</span>
              </button>
              <span
                v-else
                class="text-ink bg-success/15 shrink-0 rounded-full px-3 py-1 font-mono text-[11px] font-medium tracking-[0.18em] uppercase shadow-sm"
              >
                已完成
              </span>
            </div>
          </motion.li>
        </ol>
      </section>
    </div>
  </main>
</template>
