<!--
  LearningList — /learning 入口页.

  视觉契约:
   - 顶部"扉页":标题 + 一段引领句,整张置于圆角 2xl + soft shadow 的 card 中。
   - 主题 / 目标 / 进阶(模型 + 补充要求)三段向导(LearningWizard 子组件):
     i 主题必填 → ii 目标可选 → iii 进阶可选(模型 + 补充要求);
     TOC label 可自由点跳,不强制顺序;02 提供"跳过 → 直接生成"。
   - 下方"我的学习"目录:每条记录是一张圆角 2xl 卡片,hover 时阴影抬升。
   - 保持所有测试可见文案与 aria 语义。

  行为契约:
   - 主题输入框 + "生成课程" 按钮(wizard step 3):点击提交后进入"生成中"
     态,后端生成是异步的,前端轮询 ready 后 router.push 到 /learning/course/:courseId。
   - "我的学习" 区块:列出当前 owner 的所有进度项(topic、已完成 session、
     练习状态、下一节)。点 "继续学习" 跳到对应 session;已全部完成的展示
     "已完成" 徽标。
   - 匿名友好:无登录墙;owner key 由 getAnonId() 持有。
   - 模型选择位于 wizard step 3 内;父组件只持有 modelDraft state + 透传给
     submitTopic,UI 完全在子组件里。
-->
<script setup lang="ts">
import { BookOpen, Loader2, RotateCcw } from '@lucide/vue';
import { useMediaQuery } from '@vueuse/core';
import { motion } from 'motion-v';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/features/auth';
import { EASE } from '@/constants/motionPresets';
import { useLearningCourse } from '@/features/learning/composables/useLearningCourse';
import type { LearningProgressItem } from '@/features/learning/types';
import LearningWizard from './LearningWizard.vue';

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

/** trigger 是否要禁用某个特定选项：premium 模型仅登录用户可选。 */
function isOptionDisabled(modelIsPremium: boolean): boolean {
  return modelIsPremium && !auth.isAuthenticated;
}

/** 触发生成;ready 后跳转。 */
async function onGenerate() {
  const t = draft.value.trim();
  if (!t) return;
  setTimeout(() => void loadProgress(), 2000);
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
    void loadProgress();
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
            learning · v3
          </p>
          <h1
            class="text-ink font-serif text-3xl leading-tight font-medium tracking-tight sm:text-4xl"
          >
            What do you wanna learn?
          </h1>
          <p class="text-muted mt-3 max-w-xl text-sm leading-relaxed">
            你想要了解什么？生成一份专属于你的课程讲义、资源和练习。
          </p>
        </header>

        <!-- 主题 / 目标 / 进阶(模型 + 补充要求)三段向导(wizard step 1-3) -->
        <LearningWizard
          :topic="draft"
          :goal="goalDraft"
          :extra-prompt="extraPromptDraft"
          :submitting="submitting"
          :models="models"
          :model-draft="modelDraft"
          :is-option-disabled="isOptionDisabled"
          @update:topic="draft = $event"
          @update:goal="goalDraft = $event"
          @update:extra-prompt="extraPromptDraft = $event"
          @update:model-draft="modelDraft = $event"
          @submit="onGenerate"
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
            :initial="
              reducedMotion ? false : { opacity: 0, y: 8, filter: 'blur(4px)' }
            "
            :animate="
              reducedMotion
                ? undefined
                : { opacity: 1, y: 0, filter: 'blur(0px)' }
            "
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
                class="bg-accent/20 text-accent inline-flex shrink-0 cursor-not-allowed items-center gap-1 rounded-full px-4 py-1.5 font-mono text-[11px] font-medium tracking-[0.18em] uppercase shadow-sm"
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
