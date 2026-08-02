<!--
  CourseView — /learning/course/:courseId 课程概览页.

  视觉契约:
   - 顶部标题卡:圆角 2xl + shadow-md,内部放下 metadata + spine progress。
   - 课列表是签名构图:整张面板圆角 2xl,行内 left-rule + 阴影抬升表达 current。
   - 学习使命 / 学习资源:独立的圆角 2xl 卡片,折叠时 row 高度收缩,展开时内容展示。
   - 「继续下一课」CTA pill 化,主按钮带 shadow-accent/30。

  行为契约 (task-353 重构):
   - 挂载时 loadCourse(courseId):
       ready → 直接渲染课列表 + 资源
       pending → 启动轮询,展示 spinner + "正在为你生成课程包…"
       failed → 展示错误态
   - 顶部进度条:已完成 session 数 / 总 session 数 (`lessons.length`)。
   - 课列表:`course.lessons` 按 id 排序,每行展示编号(0001, 0002…)+ 标题
     + 状态徽标(已完成 / 当前 / 未开始)。点击进入单课路由。
   - 资源面板:`course.resource_md` 通过 renderMarkdown 渲染;以折叠/tab 形式
     展示,避免首屏过长。
   - 「继续下一课」按钮:出现在仍有 next session 时;触发 generateNextLesson,
     若返回 pending 则 poll course 直到 lessons 列表增长,最后 router.push
     到新生成的 lesson 详情。
-->
<script setup lang="ts">
import { useHead } from '@vueuse/head';
import hljs from 'highlight.js/lib/common';
import 'highlight.js/scss/rainbow.scss';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ArrowLeft,
  ChevronRight,
  Library,
  Loader2,
  RefreshCcw,
  Sparkles,
  Target,
} from '@lucide/vue';
import { Button } from '@/components';
import { renderMarkdown } from '@/composables';
import { useLearningCourse } from '@/features/learning/composables/useLearningCourse';
import type {
  LearningLesson,
  LearningProgressItem,
} from '@/features/learning/types';

defineOptions({ name: 'CourseView' });

const route = useRoute();
const router = useRouter();

const {
  course,
  courseStatus,
  submitting,
  error,
  progressList,
  loadCourse,
  loadProgress,
  generateNextLesson,
  pollForLesson,
  clearError,
} = useLearningCourse();

const courseId = computed(() => String(route.params.courseId ?? ''));

/** 触发渐进产出的本地 loading。 */
const generating = ref(false);

/** 学习使命面板展开/折叠:与学习资源同模式(grid-template-rows 0fr↔1fr 过渡)。 */
const missionOpen = ref(false);
/** 资源面板展开/折叠:与学习使命同模式(grid-template-rows 0fr↔1fr 过渡)。 */
const resourceOpen = ref(false);
const resourceHtml = computed(() =>
  course.value ? renderMarkdown(course.value.resource_md) : '',
);

/** 学习使命（MISSION.md）渲染：缺失 / 空串时整块隐藏。 */
const missionHtml = computed(() =>
  course.value?.mission_md?.trim()
    ? renderMarkdown(course.value.mission_md)
    : '',
);

/** 当前课程在 progressList 里的最新条目;可能 undefined(冷启动)。 */
const progressItem = computed<LearningProgressItem | undefined>(() =>
  progressList.value.find((p) => p.course_id === courseId.value),
);

/** 已完成的 session id 集合(从 progress 同步)。 */
const sessionsDone = computed<Set<number>>(
  () => new Set(progressItem.value?.sessions_done ?? []),
);

/** 排序后的 lesson 列表。 */
const lessons = computed<LearningLesson[]>(() => {
  const ls = course.value?.lessons ?? [];
  return [...ls].sort((a, b) => a.id - b.id);
});

/** 下一节编号:取 progressItem.next_session,缺省时算 lessons 第一个未完成。 */
const nextLessonId = computed<number | null>(() => {
  const fromProgress = progressItem.value?.next_session ?? null;
  if (fromProgress !== null) return fromProgress;
  const first = lessons.value.find((l) => !sessionsDone.value.has(l.id));
  return first?.id ?? null;
});

const totalSessions = computed(() => lessons.value.length);
const doneSessions = computed(
  () => lessons.value.filter((l) => sessionsDone.value.has(l.id)).length,
);
const progressPct = computed(() => {
  if (!totalSessions.value) return 0;
  return Math.min(
    100,
    Math.round((doneSessions.value / totalSessions.value) * 100),
  );
});

const isCourseDone = computed(
  () => totalSessions.value > 0 && doneSessions.value === totalSessions.value,
);

/** 课程包加载入口:轮询直到 ready, 同时拉一次 progress 列表。 */
async function load() {
  if (!courseId.value) return;
  try {
    await Promise.all([loadCourse(courseId.value), loadProgress()]);
  } catch {
    // error 由 composable 写入
  }
}

watch(
  () => route.params.courseId,
  () => {
    if (courseId.value) void load();
  },
);

/** markdown 渲染后,等 Vue 完成 patch 再对 <pre><code> 上色。 */
watch(
  [missionHtml, resourceHtml],
  async ([mission, resource]) => {
    if (!mission && !resource) return;
    await nextTick();
    hljs.highlightAll();
  },
);

onMounted(() => {
  void load();
});

function statusOf(lesson: LearningLesson): 'done' | 'current' | 'todo' {
  if (sessionsDone.value.has(lesson.id)) return 'done';
  if (nextLessonId.value === lesson.id) return 'current';
  return 'todo';
}

function statusLabel(s: ReturnType<typeof statusOf>): string {
  if (s === 'done') return '已完成';
  if (s === 'current') return '当前';
  return '未开始';
}

function openLesson(lesson: LearningLesson) {
  void router.push({
    name: 'learning-lesson',
    params: { courseId: courseId.value, lessonId: String(lesson.id) },
  });
}

function padId(id: number): string {
  return id.toString().padStart(4, '0');
}

function rowContainerCls(s: ReturnType<typeof statusOf>): string {
  if (s === 'current') {
    return 'bg-accent/10 ring-1 ring-accent/30 shadow-accent/25 shadow-md';
  }
  if (s === 'done') {
    return 'bg-card shadow-sm';
  }
  return 'bg-card shadow-sm';
}

/**
 * 渐进产出下一课:
 *   1. POST generateNextLesson
 *   2. 若 pending → poll course 直到 lessons 增长到目标数
 *   3. 拿到新课后 router.push 到 learning-lesson
 *   4. already_generated → 直接 reload course(同步命中,无新 lesson,
 *      则保留现有 lessons 的最大值并跳到该课 — 通常意味着所有 lessons
 *      都已生成,UI 不应误以为 "失败"。)
 */
async function onGenerateNext() {
  if (!courseId.value || generating.value) return;
  generating.value = true;
  try {
    const resp = await generateNextLesson(courseId.value);
    const currentLen = course.value?.lessons.length ?? 0;

    if (resp.status === 'pending' && resp.next_lesson !== null) {
      // 等 lessons 增长到至少 next_lesson
      const updated = await pollForLesson(
        courseId.value,
        Math.max(currentLen + 1, resp.next_lesson),
      );
      await loadProgress();
      if (updated) {
        await router.push({
          name: 'learning-lesson',
          params: {
            courseId: courseId.value,
            lessonId: String(updated.lessons.length),
          },
        });
      }
    } else if (resp.status === 'already_generated') {
      // 同步命中:服务端认为新课已就绪;刷新 course + progress,然后跳到
      // 期望的下一节。
      await loadCourse(courseId.value);
      await loadProgress();
      const target = resp.next_lesson ?? nextLessonId.value;
      if (target !== null) {
        await router.push({
          name: 'learning-lesson',
          params: {
            courseId: courseId.value,
            lessonId: String(target),
          },
        });
      }
    } else {
      // failed
      // error 已在 composable 写入
    }
  } catch {
    // error 已写入 composable
  } finally {
    generating.value = false;
  }
}

function goBack() {
  void router.push({ name: 'learning' });
}

function retry() {
  clearError();
  void load();
}

useHead({
  title: () =>
    course.value
      ? `${course.value.topic} - 学习 - Kuroome Blog`
      : '学习中 - Kuroome Blog',
});
</script>

<template>
  <main class="bg-page min-h-screen w-full">
    <div class="mx-auto w-full max-w-4xl px-5 py-8 sm:py-25">
      <!-- Top nav -->
      <button
        type="button"
        class="text-muted hover:text-ink focus-visible:ring-ring bg-card focus-visible:ring-offset-page mb-8 inline-flex items-center gap-1 rounded-full px-3 py-1 font-mono text-[11px] tracking-[0.18em] uppercase shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        @click="goBack"
      >
        <ArrowLeft class="h-3 w-3" aria-hidden="true" />
        返回学习列表
      </button>

      <!-- Loading (pending) -->
      <section
        v-if="submitting && !course"
        class="bg-card text-muted flex flex-col items-center gap-3 rounded-2xl px-6 py-16 text-center shadow-md"
      >
        <Loader2
          class="text-accent h-6 w-6 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        <p class="text-ink text-sm font-medium">正在为你生成课程包…</p>
        <p class="text-muted text-xs">
          讲义 · 资源 · 练习 三件套正在准备中,请稍候
        </p>
      </section>

      <!-- Failed -->
      <section
        v-else-if="courseStatus === 'failed' || error"
        class="bg-card text-muted flex flex-col items-center gap-3 rounded-2xl px-6 py-12 text-center shadow-md"
      >
        <p class="text-destructive text-sm font-medium">
          {{ error || '课程生成失败' }}
        </p>
        <Button size="sm" variant="outline" @click="retry">
          <RefreshCcw class="h-3.5 w-3.5" aria-hidden="true" />
          重试
        </Button>
      </section>

      <!-- Course ready -->
      <template v-else-if="course">
        <!-- Title + metadata -->
        <header
          class="bg-card mb-6 rounded-2xl px-6 py-6 shadow-md sm:px-8 sm:py-8"
        >
          <p
            class="text-muted mb-3 font-mono text-[11px] tracking-[0.18em] uppercase"
          >
            course
          </p>
          <h1
            class="text-ink font-serif text-3xl leading-tight font-medium tracking-tight sm:text-4xl"
          >
            {{ course.topic }}
          </h1>
          <div
            class="text-muted mt-3 flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-[0.12em] uppercase"
          >
            <span
              class="bg-surface/60 inline-flex items-center rounded-full px-2.5 py-0.5 shadow-inner"
            >
              {{ lessons.length }} 节课
            </span>
            <span aria-hidden="true">·</span>
            <span
              class="bg-surface/60 inline-flex items-center rounded-full px-2.5 py-0.5 shadow-inner"
            >
              {{ doneSessions }} / {{ totalSessions }} 节已完成
            </span>
            <span
              v-if="isCourseDone"
              class="bg-success/15 text-success inline-flex items-center rounded-full px-2.5 py-0.5 shadow-sm"
            >
              已全部完成
            </span>
          </div>

          <!-- Spine progress -->
          <div
            class="bg-muted/40 mt-5 h-1.5 w-full overflow-hidden rounded-full shadow-inner"
            role="progressbar"
            :aria-valuenow="progressPct"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <div
              class="bg-accent shadow-accent/30 h-full rounded-full transition-all duration-300 motion-reduce:transition-none"
              :style="{ width: `${progressPct}%` }"
            />
          </div>
        </header>

        <!-- Mission (task-365):学习使命文档,缺失时整块隐藏。默认折叠,与学习资源同模式。 -->
        <section
          v-if="missionHtml"
          class="bg-card mb-4 overflow-hidden rounded-2xl shadow-sm"
        >
          <button
            type="button"
            class="hover:bg-surface/40 focus-visible:ring-ring flex w-full items-center gap-2 px-5 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset sm:px-6"
            :aria-expanded="missionOpen"
            aria-controls="mission-panel"
            @click="missionOpen = !missionOpen"
          >
            <Target class="text-accent h-4 w-4" aria-hidden="true" />
            <span
              class="text-ink flex-1 font-mono text-[11px] tracking-[0.18em] uppercase"
            >
              学习使命
            </span>
            <ChevronRight
              class="text-muted h-4 w-4 transition-transform motion-reduce:transition-none"
              :class="missionOpen ? 'rotate-90' : ''"
              aria-hidden="true"
            />
          </button>
          <div
            id="mission-panel"
            class="collapsible grid"
            :class="missionOpen ? 'is-open' : ''"
            :aria-hidden="!missionOpen"
          >
            <div class="collapsible-inner min-w-0 overflow-hidden">
              <article
                class="prose prose-sm text-ink max-w-none px-5 py-4 sm:px-6"
                v-html="missionHtml"
              />
            </div>
          </div>
        </section>

        <!-- Lesson spine -->
        <section
          v-if="lessons.length > 0"
          class="bg-card mb-4 rounded-2xl p-3 shadow-sm"
          aria-label="课节目录"
        >
          <ol class="space-y-2">
            <li v-for="lesson in lessons" :key="lesson.id">
              <button
                type="button"
                class="hover:bg-surface/40 focus-visible:ring-ring flex w-full items-baseline gap-3 rounded-xl py-2.5 pr-3 pl-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-inset"
                :class="rowContainerCls(statusOf(lesson))"
                @click="openLesson(lesson)"
              >
                <span
                  class="font-mono text-xs tabular-nums"
                  :class="
                    statusOf(lesson) === 'done'
                      ? 'text-success'
                      : statusOf(lesson) === 'current'
                        ? 'text-accent'
                        : 'text-muted'
                  "
                >
                  {{ padId(lesson.id) }}
                </span>
                <span class="text-ink flex-1 text-sm font-medium">
                  {{ lesson.title }}
                </span>
                <span
                  class="shrink-0 rounded-full px-2.5 py-0.5 font-mono text-[11px] tracking-[0.18em] uppercase"
                  :class="
                    statusOf(lesson) === 'done'
                      ? 'bg-success/15 text-success'
                      : statusOf(lesson) === 'current'
                        ? 'bg-accent/15 text-accent'
                        : 'bg-muted/40 text-muted'
                  "
                >
                  {{ statusLabel(statusOf(lesson)) }}
                </span>
                <ChevronRight
                  class="text-muted h-3.5 w-3.5 shrink-0"
                  aria-hidden="true"
                />
              </button>
            </li>
          </ol>
        </section>

        <!-- Empty state:课程还没产出任何 lesson -->
        <section
          v-else
          class="bg-card text-muted mb-4 rounded-2xl px-6 py-10 text-center text-sm shadow-sm"
        >
          这门课还没有生成任何课节。点击下方按钮生成第一课。
        </section>

        <!-- Action row:继续下一课 -->
        <section
          class="bg-card mb-4 flex flex-col items-stretch gap-3 rounded-2xl p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div
            class="text-muted font-mono text-[11px] tracking-[0.12em] uppercase"
          >
            <template v-if="nextLessonId !== null">
              下一节:<span class="text-ink font-mono">{{
                padId(nextLessonId)
              }}</span>
              <span
                v-if="
                  progressItem?.next_session !== null &&
                  progressItem?.next_session !== undefined
                "
                class="ml-2"
              >
                · 由进度决定
              </span>
            </template>
            <template v-else-if="isCourseDone"> 所有课节已完成,棒! </template>
            <template v-else> 下一节尚未生成,点击右侧按钮产出。 </template>
          </div>
          <div class="flex shrink-0 gap-2">
            <Button
              v-if="!isCourseDone"
              size="md"
              :disabled="generating"
              class="shadow-accent/30 shadow-md hover:shadow-lg"
              @click="onGenerateNext"
            >
              <Loader2
                v-if="generating"
                class="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              <Sparkles v-else class="h-3.5 w-3.5" aria-hidden="true" />
              <span class="font-mono">{{
                generating ? '生成中…' : '继续下一课'
              }}</span>
            </Button>
          </div>
        </section>

        <!-- Resource panel:与学习使命同模式(grid-template-rows 0fr↔1fr 折叠过渡)。 -->
        <section
          v-if="course.resource_md.trim().length > 0"
          class="bg-card overflow-hidden rounded-2xl shadow-sm"
        >
          <button
            type="button"
            class="hover:bg-surface/40 focus-visible:ring-ring flex w-full items-center gap-2 px-5 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset sm:px-6"
            :aria-expanded="resourceOpen"
            aria-controls="resource-panel"
            @click="resourceOpen = !resourceOpen"
          >
            <Library class="text-muted h-4 w-4" aria-hidden="true" />
            <span
              class="text-ink flex-1 font-mono text-[11px] tracking-[0.18em] uppercase"
            >
              学习资源
            </span>
            <ChevronRight
              class="text-muted h-4 w-4 transition-transform motion-reduce:transition-none"
              :class="resourceOpen ? 'rotate-90' : ''"
              aria-hidden="true"
            />
          </button>
          <div
            id="resource-panel"
            class="collapsible grid"
            :class="resourceOpen ? 'is-open' : ''"
            :aria-hidden="!resourceOpen"
          >
            <div class="collapsible-inner min-w-0 overflow-hidden">
              <article
                class="prose prose-sm text-ink max-w-none px-5 pb-6 sm:px-6"
                v-html="resourceHtml"
              />
            </div>
          </div>
        </section>

        <!-- Footer hint -->
        <p
          v-if="lessons.length === 0"
          class="text-muted py-6 text-center font-mono text-[11px] tracking-[0.18em] uppercase"
        >
          这门课程将按你点「继续下一课」逐步产出课节。
        </p>
      </template>
    </div>
  </main>
</template>

<style scoped>
/* 折叠容器：grid 单行，行高 0fr ↔ 1fr 平滑过渡。
   grid-template-rows 不支持 fr 数值动画,但从 0fr → 1fr 可过渡
   （CSS Grid Level 2 行为，现代浏览器均支持）。
   内层加 min-w-0 + overflow-hidden,否则子元素撑开无法折叠。 */
.collapsible {
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}
.collapsible.is-open {
  grid-template-rows: 1fr;
}
.collapsible-inner {
  min-height: 0;
}

@media (prefers-reduced-motion: reduce) {
  .collapsible {
    transition: none;
  }
}
</style>
