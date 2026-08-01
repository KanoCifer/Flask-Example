<!--
  LearningList — /learning 入口页.

  行为契约:
   - 顶部主题输入框 + "生成课程" 按钮:点击提交后进入"生成中"态,后端生成
     是异步的,前端轮询 ready 后 router.push 到 /learning/course/:courseId。
   - "我的学习" 区块:列出当前 owner 的所有进度项(topic、已完成 session、
     练习状态、下一节)。点 "继续学习" 跳到对应 session;已全部完成的展示
     "已完成" 徽标。
   - 匿名友好:无登录墙;owner key 由 getAnonId() 持有。
-->
<script setup lang="ts">
import { useHead } from '@vueuse/head';
import { ArrowRight, BookOpen, Loader2, RotateCcw } from '@lucide/vue';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Button } from '@/components';
import { useLearningCourse } from '@/features/learning/composables/useLearningCourse';
import type { LearningProgressItem } from '@/features/learning/types';

defineOptions({ name: 'LearningList' });

useHead({
  title: '学习 - Kuroome Blog',
  meta: [
    {
      name: 'description',
      content: 'AI 课程生成 · 自主练习 · 客户端判分。匿名可用。',
    },
  ],
});

const router = useRouter();
const {
  submitting,
  error,
  progressList,
  progressLoading,
  submitTopic,
  loadProgress,
  clearError,
} = useLearningCourse();

/** 输入框的本地状态(同步到 composable.topic 也行,这里保留本地草稿)。 */
const draft = ref('');
/** 学习目标(可选)的本地草稿。 */
const goalDraft = ref('');

/** 主题 / 目标两个输入框共享的基座样式（宽度差异经 :class 拼接）。 */
const inputCls =
  'text-ink placeholder-muted bg-surface/40 focus-visible:ring-ring/40 border-border/60 rounded-lg border px-3 py-2.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60';

/** 触发生成;ready 后跳转。 */
async function onGenerate() {
  const t = draft.value.trim();
  if (!t) return;
  try {
    const { course_id } = await submitTopic(t, goalDraft.value);
    // 跳转前清掉草稿,这样回到首页不会看到残留文本
    draft.value = '';
    goalDraft.value = '';
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

onMounted(() => {
  void loadProgress();
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
    <div class="mx-auto w-full max-w-3xl px-5 py-10 sm:py-25">
      <!-- Header -->
      <header class="mb-10 text-center">
        <div
          class="bg-accent/10 text-accent mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl"
        >
          <BookOpen class="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 class="text-ink font-serif text-2xl font-medium tracking-wide">
          学习工作台
        </h1>
        <p class="text-muted mt-2 text-sm">
          输入主题,生成专属课程包 — 讲义 · 资源 · 练习
        </p>
      </header>

      <!-- Topic input -->
      <section class="bg-card ring-border/40 rounded-2xl p-5 ring-1 sm:p-6">
        <label class="text-muted mb-2 block text-xs tracking-widest">
          想要学习的主题
        </label>
        <div class="flex flex-col gap-3 sm:flex-row">
          <input
            v-model="draft"
            type="text"
            :disabled="submitting"
            placeholder="例如:康德《纯粹理性批判》的先验演绎"
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
            <span>{{ submitting ? '生成中…' : '生成课程' }}</span>
            <ArrowRight
              v-if="!submitting"
              class="h-3.5 w-3.5"
              aria-hidden="true"
            />
          </Button>
        </div>

        <!-- 可选学习目标 -->
        <label class="text-muted mt-4 mb-2 block text-xs tracking-widest">
          学习目标（可选）
        </label>
        <input
          v-model="goalDraft"
          type="text"
          :disabled="submitting"
          placeholder="例如:能独立复述先验演绎的论证结构,并完成 5 道自测题"
          maxlength="200"
          :class="[inputCls, 'w-full']"
          @keydown.enter="onGenerate"
        />

        <p v-if="error" class="text-destructive mt-3 text-xs leading-relaxed">
          {{ error }}
          <button
            type="button"
            class="text-muted hover:text-ink ml-2 underline-offset-2 hover:underline"
            @click="clearError"
          >
            知道了
          </button>
        </p>
        <p class="text-muted mt-3 text-xs leading-relaxed">
          课程生成约需 10–30 秒,生成完成后会自动跳转到课程详情页。
        </p>
      </section>

      <!-- Progress list -->
      <section class="mt-10">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-ink font-serif text-base font-medium">我的学习</h2>
          <button
            type="button"
            class="text-muted hover:text-ink focus-visible:ring-ring/40 inline-flex items-center gap-1 text-xs transition-colors focus:outline-none focus-visible:ring-2"
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
          class="space-y-2"
        >
          <div
            v-for="n in 2"
            :key="n"
            class="bg-surface h-20 animate-pulse rounded-xl"
          />
        </div>

        <!-- Empty -->
        <div
          v-else-if="progressList.length === 0"
          class="bg-card ring-border/40 text-muted rounded-2xl px-5 py-10 text-center text-sm ring-1"
        >
          还没有学习记录。输入主题开始你的第一门课。
        </div>

        <!-- Items -->
        <ul v-else class="space-y-2.5">
          <li
            v-for="item in progressList"
            :key="item.course_id"
            class="bg-card ring-border/40 hover:ring-border/80 rounded-2xl px-4 py-3.5 ring-1 transition-colors sm:px-5"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <h3 class="text-ink truncate text-sm font-medium">
                  {{ item.topic }}
                </h3>
                <p class="text-muted mt-1 text-xs">
                  {{ statusLabel(item) }}
                  <span v-if="item.exercise_done" class="text-success ml-1">
                    · 练习已完成
                  </span>
                </p>
              </div>
              <button
                v-if="item.next_session !== null"
                type="button"
                class="bg-accent/10 text-accent hover:bg-accent/20 focus-visible:ring-ring/40 shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2"
                @click="onContinue(item)"
              >
                继续学习 →
              </button>
              <span
                v-else
                class="bg-success/15 text-success shrink-0 rounded-lg px-2.5 py-1 text-xs"
              >
                已完成
              </span>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </main>
</template>
