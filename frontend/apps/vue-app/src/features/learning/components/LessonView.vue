<!--
  LessonView — /learning/course/:courseId/lesson/:lessonId 单课详情页.

  行为契约 (task-353 重构):
   - 挂载时 loadCourse(courseId) → 在 course.lessons 中按 id 找当前 lesson;
     找不到则显示空态。
   - 两个 tab:正文(renderMarkdown(lesson.md))+ 练习(lesson.exercises → ExerciseCard 列表)。
   - 练习全部判分正确时,「本节完成」按钮亮起;点击 → markSessionDone(courseId, lesson.id)。
   - 「下一课」 → generateNextLesson(courseId):
       pending:轮询 course 直到 lessons 列表增长,然后 router.push 到新 lesson
       already_generated:reload course 后跳到 next_lesson
       failed:显示错误
   - 返回 → /learning/course/:courseId
-->
<script setup lang="ts">
import { useHead } from '@vueuse/head';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Library,
  Loader2,
  RefreshCcw,
  Sparkles,
} from '@lucide/vue';
import { Button } from '@/components';
import { renderMarkdown } from '@/composables';
import { useLearningCourse } from '@/features/learning/composables/useLearningCourse';
import type {
  LearningLesson,
  LearningProgressItem,
} from '@/features/learning/types';
import ExerciseCard from '@/features/learning/components/ExerciseCard.vue';

defineOptions({ name: 'LessonView' });

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
  markSessionDone,
  generateNextLesson,
  pollForLesson,
  clearError,
} = useLearningCourse();

const courseId = computed(() => String(route.params.courseId ?? ''));
const lessonId = computed(() => Number(route.params.lessonId ?? 0));

type TabKey = 'lesson' | 'exercises';
const activeTab = ref<TabKey>('lesson');

/** 当前 lesson;找不到时为 undefined(空态)。 */
const lesson = computed<LearningLesson | undefined>(() =>
  course.value?.lessons.find((l) => l.id === lessonId.value),
);

/** 当前课程在 progressList 里的最新条目(用于 next session 提示)。 */
const progressItem = computed<LearningProgressItem | undefined>(() =>
  progressList.value.find((p) => p.course_id === courseId.value),
);

/** 该 lesson 是否已标记完成(乐观 + 持久化合并判定)。 */
const sessionMarked = ref(false);
const isSessionDone = computed(
  () =>
    sessionMarked.value ||
    (progressItem.value?.sessions_done ?? []).includes(lessonId.value),
);

/** 渲染 lesson.md。 */
const lessonHtml = computed(() =>
  lesson.value ? renderMarkdown(lesson.value.md) : '',
);

/** 练习题列表。 */
const exercises = computed(() => lesson.value?.exercises ?? []);

/** 判分统计:{correct, total}。 */
const scoreState = ref<{ correct: number; total: number }>({
  correct: 0,
  total: 0,
});
const allExercisesAnsweredCorrectly = computed(
  () =>
    exercises.value.length > 0 &&
    scoreState.value.total >= exercises.value.length &&
    scoreState.value.correct >= exercises.value.length,
);

/** 触发渐进产出/下一课的本地 loading。 */
const advancing = ref(false);

/** 路由:加载入口。 */
async function load() {
  if (!courseId.value) return;
  scoreState.value = { correct: 0, total: 0 };
  sessionMarked.value = false;
  try {
    await Promise.all([loadCourse(courseId.value), loadProgress()]);
  } catch {
    // error 由 composable 写入
  }
}

watch(
  () => [route.params.courseId, route.params.lessonId],
  () => {
    if (courseId.value && lessonId.value) void load();
  },
);

onMounted(() => {
  void load();
});

function onExerciseAnswered(correct: boolean) {
  scoreState.value.total += 1;
  if (correct) scoreState.value.correct += 1;
}

async function onMarkSessionDone() {
  if (!course.value || !lesson.value) return;
  try {
    await markSessionDone(course.value.course_id, lesson.value.id);
    sessionMarked.value = true;
  } catch {
    // error 已写入 composable
  }
}

function goBack() {
  void router.push({
    name: 'learning-course',
    params: { courseId: courseId.value },
  });
}

function retry() {
  clearError();
  void load();
}

/**
 * 渐进产出下一课 + 自动跳转。
 * 与 CourseView.onGenerateNext 类似的逻辑;但这里通常 lesson 是当前 lessons
 * 中的最后一节,所以生成后 next lesson = lessons.length + 1。
 */
async function onAdvance() {
  if (!course.value || advancing.value) return;
  advancing.value = true;
  try {
    const resp = await generateNextLesson(courseId.value);
    const currentLen = course.value.lessons.length;

    if (resp.status === 'pending' && resp.next_lesson !== null) {
      const updated = await pollForLesson(
        courseId.value,
        Math.max(currentLen + 1, resp.next_lesson),
      );
      await loadProgress();
      if (updated) {
        // 跳到当前课对应的下一课(序号 = 当前 lessonId + 1)
        const target = Math.min(lessonId.value + 1, updated.lessons.length);
        if (target !== lessonId.value) {
          await router.push({
            name: 'learning-lesson',
            params: {
              courseId: courseId.value,
              lessonId: String(target),
            },
          });
        }
      }
    } else if (resp.status === 'already_generated') {
      await loadCourse(courseId.value);
      await loadProgress();
      const target =
        resp.next_lesson !== null
          ? resp.next_lesson
          : Math.min(lessonId.value + 1, course.value.lessons.length);
      if (target !== lessonId.value) {
        await router.push({
          name: 'learning-lesson',
          params: {
            courseId: courseId.value,
            lessonId: String(target),
          },
        });
      }
    }
    // failed:error 已写入 composable
  } catch {
    // error 已写入 composable
  } finally {
    advancing.value = false;
  }
}

const tabs: { key: TabKey; label: string }[] = [
  { key: 'lesson', label: '正文' },
  { key: 'exercises', label: '练习' },
];

useHead({
  title: () => {
    if (lesson.value && course.value) {
      return `${lesson.value.title} · ${course.value.topic} - 学习 - Kuroome Blog`;
    }
    return '学习中 - Kuroome Blog';
  },
});
</script>

<template>
  <main class="bg-page min-h-screen w-full">
    <div class="mx-auto w-full max-w-4xl px-5 py-8 sm:py-25">
      <!-- Top nav -->
      <button
        type="button"
        class="text-muted hover:text-ink focus-visible:ring-ring/40 mb-5 inline-flex items-center gap-1 text-xs transition-colors focus:outline-none focus-visible:ring-2"
        @click="goBack"
      >
        <ArrowLeft class="h-3 w-3" aria-hidden="true" />
        返回课程概览
      </button>

      <!-- Loading (course pending) -->
      <section
        v-if="submitting && !course"
        class="bg-card ring-border/40 flex flex-col items-center gap-3 rounded-2xl px-5 py-16 text-center ring-1"
      >
        <Loader2
          class="text-accent h-6 w-6 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        <p class="text-ink text-sm font-medium">正在加载课程…</p>
      </section>

      <!-- Failed -->
      <section
        v-else-if="courseStatus === 'failed' || error"
        class="bg-card ring-border/40 flex flex-col items-center gap-3 rounded-2xl px-5 py-12 text-center ring-1"
      >
        <p class="text-destructive text-sm font-medium">
          {{ error || '课程生成失败' }}
        </p>
        <Button size="sm" variant="outline" @click="retry">
          <RefreshCcw class="h-3.5 w-3.5" aria-hidden="true" />
          重试
        </Button>
      </section>

      <!-- Lesson not found -->
      <section
        v-else-if="course && !lesson"
        class="bg-card ring-border/40 flex flex-col items-center gap-3 rounded-2xl px-5 py-12 text-center ring-1"
      >
        <p class="text-ink text-sm font-medium">找不到该课节</p>
        <p class="text-muted text-xs">该课节可能尚未生成,或链接已失效。</p>
        <Button size="sm" variant="outline" @click="goBack">
          <ArrowLeft class="h-3.5 w-3.5" aria-hidden="true" />
          返回课程概览
        </Button>
      </section>

      <!-- Lesson ready -->
      <template v-else-if="course && lesson">
        <!-- Title -->
        <header class="mb-5">
          <div class="text-muted mb-1 flex items-center gap-2 text-xs">
            <Library class="h-3 w-3" aria-hidden="true" />
            <span>{{ course.topic }}</span>
            <span aria-hidden="true">·</span>
            <span class="font-mono">
              {{ lesson.id.toString().padStart(4, '0') }}
            </span>
          </div>
          <h1 class="text-ink font-serif text-2xl font-medium tracking-wide">
            {{ lesson.title }}
          </h1>
          <p
            v-if="isSessionDone"
            class="text-success mt-1 flex items-center gap-1 text-xs"
          >
            <Check class="h-3 w-3" aria-hidden="true" />
            本节已完成
          </p>
        </header>

        <!-- Tabs -->
        <nav
          class="bg-card ring-border/40 mb-4 inline-flex rounded-xl p-1 ring-1"
        >
          <button
            v-for="t in tabs"
            :key="t.key"
            type="button"
            class="focus-visible:ring-ring/40 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors focus:outline-none focus-visible:ring-2"
            :class="
              activeTab === t.key
                ? 'bg-accent text-contrast'
                : 'text-muted hover:text-ink'
            "
            @click="activeTab = t.key"
          >
            {{ t.label }}
            <span
              v-if="t.key === 'exercises'"
              class="text-muted font-mono text-[10px]"
            >
              {{ exercises.length }}
            </span>
          </button>
        </nav>

        <!-- Tab content:正文 -->
        <article
          v-if="activeTab === 'lesson'"
          class="prose prose-sm text-ink max-w-none rounded-2xl"
          v-html="lessonHtml"
        />

        <!-- Tab content:练习 -->
        <section v-else class="space-y-4">
          <div v-if="exercises.length === 0" class="text-muted text-sm">
            这节课还没有练习题。
          </div>
          <ExerciseCard
            v-for="(m, idx) in exercises"
            :key="m.id"
            :exercise="m"
            :index="idx + 1"
            @answered="onExerciseAnswered"
          />

          <!-- Action row -->
          <div
            v-if="exercises.length > 0"
            class="bg-card ring-border/40 mt-3 flex flex-col items-stretch gap-2 rounded-2xl p-4 ring-1 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="text-muted text-xs">
              正确
              <span class="text-success font-mono">{{
                scoreState.correct
              }}</span>
              /
              <span class="font-mono">{{ scoreState.total }}</span>
              <span v-if="isSessionDone" class="text-success ml-2">
                · 本节已完成
              </span>
            </div>
            <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                size="sm"
                variant="outline"
                :disabled="isSessionDone || !allExercisesAnsweredCorrectly"
                @click="onMarkSessionDone"
              >
                <Check class="h-3.5 w-3.5" aria-hidden="true" />
                本节完成
              </Button>
              <Button size="sm" :disabled="advancing" @click="onAdvance">
                <Loader2
                  v-if="advancing"
                  class="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
                <Sparkles v-else class="h-3.5 w-3.5" aria-hidden="true" />
                <span>{{ advancing ? '生成中…' : '下一课' }}</span>
                <ChevronRight
                  v-if="!advancing"
                  class="h-3.5 w-3.5"
                  aria-hidden="true"
                />
              </Button>
            </div>
          </div>
        </section>
      </template>
    </div>
  </main>
</template>
