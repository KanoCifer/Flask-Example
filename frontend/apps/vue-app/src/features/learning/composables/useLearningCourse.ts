// Learning course 域 composable.
//
// 责任范围:
//   1. submitTopic(topic) 提交学习主题,得到 course_id 后异步轮询 getCourse 直至
//      ready 或 failed。后端生成异步,前端以 setInterval 驱动轮询,轮询节奏取
//      3s — 体感接近实时,且不会压垮 LLM 生成中的后端。
//   2. loadCourse(courseId) 装载已 ready 的课程包(直接 GET)。pending 会自动
//      启动轮询。
//   3. loadProgress() 列出当前 owner 的全部进度。
//   4. markSessionDone / markExerciseDone 写入 PATCH 进度端点。
//   5. generateNextLesson(courseId) 渐进产出（task-352）— 触发生成下一课；
//      若返回 `pending`，调用方需 poll `loadCourse` 等 lessons 列表增长。
//
// 响应式状态全部走 ref,组件消费方按需解构。轮询的 timer 在 unmount 时由
// `stopPolling` 自动清掉,避免组件销毁后还在写反应式数据导致 Vue 警告。

import { onUnmounted, ref } from 'vue';
import { learningGateway } from '@/features/learning/api';
import type {
  CourseStatusResponse,
  LearningCourse,
  LearningLesson,
  LearningModel,
  LearningProgressItem,
  NextLessonResponse,
} from '@/features/learning/types';

/** 学习模型下拉失败时的硬降级（task-391）：单条 flash 选项，不阻塞主题提交。 */
const FALLBACK_MODELS: LearningModel[] = [
  { id: 'deepseek-v4-flash', label: 'Flash（快速）', is_premium: false },
];

/** 轮询节奏:3s — 后端 LLM 一次生成大约 10–30s,长 prompt + 冷启动可
 *  能更久;3s 既能反映状态变化,也不会压垮后端。 */
const POLL_INTERVAL_MS = 3_000;
/** 单次课程生成总超时:300s(5 分钟),超过即视为 failed,清理 timer。
 *  长 prompt + 冷启动兜底用 — 5 分钟足够覆盖大多数生成场景。 */
const POLL_TIMEOUT_MS = 300_000;
/** 渐进产出下一课的轮询超时:180s(3 分钟)。
 *  单课比整门课小,但冷启动可能也撑,留 3 分钟兜底。 */
const LESSON_POLL_TIMEOUT_MS = 180_000;

export interface SubmittedCourse {
  course_id: string;
  course: LearningCourse;
}

export function useLearningCourse() {
  /** 当前正在生成 / 轮询的 course_id(用于 UI 展示"正在为你生成…")。 */
  const pendingCourseId = ref<string | null>(null);
  /** 是否处于生成/轮询中。 */
  const submitting = ref(false);
  /** 错误信息,组件可直接 v-if 渲染。 */
  const error = ref<string | null>(null);
  /** 当前装载的课程包(来自轮询 ready 或 loadCourse)。 */
  const course = ref<LearningCourse | null>(null);
  /** 课程状态(轮询失败时也需要看)。 */
  const courseStatus = ref<'pending' | 'ready' | 'failed' | null>(null);
  /** 进度列表。 */
  const progressList = ref<LearningProgressItem[]>([]);
  /** 进度加载态。 */
  const progressLoading = ref(false);
  /** 可用学习模型（task-391）：前端下拉的数据源。 */
  const models = ref<LearningModel[]>([]);
  /** 模型加载态 — 用于避免 onMounted 完成前 UI 闪烁空态。 */
  const modelsLoading = ref(false);

  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let pollStartedAt = 0;

  /** 停止轮询;幂等,可重复调用。 */
  function stopPolling() {
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  /**
   * 提交主题 → 启动轮询。返回 `{course_id, course}`,ready 后 `course`
   * 已经填充完毕;调用方可直接 router.push 到课程详情。
   *
   * @param inputTopic 学习主题。
   * @param inputGoal 学习目标(可选),后端用于组织 MISSION.md 文案。
   * @param inputExtras 可选透传(task-391):`modelId` / `extraPrompt`。
   *
   * 失败语义:
   *   - 后端返回 failed:抛错并将 error 写为可读中文提示。
   *   - 轮询超过 300s:同上(超时,见 `POLL_TIMEOUT_MS`)。
   *   - 中途组件卸载:由 onUnmounted 清理 timer,`error` 不写入。
   */
  async function submitTopic(
    inputTopic: string,
    inputGoal?: string,
    inputExtras?: { modelId?: string; extraPrompt?: string },
  ): Promise<SubmittedCourse> {
    const trimmed = inputTopic.trim();
    if (!trimmed) {
      const msg = '请输入要学习的主题';
      error.value = msg;
      throw new Error(msg);
    }
    // 并发保护:上一个还没结束,直接拒绝(避免双 timer)。
    if (submitting.value) {
      const msg = '上一门课程正在生成中,请稍候…';
      error.value = msg;
      throw new Error(msg);
    }

    stopPolling();
    submitting.value = true;
    error.value = null;
    course.value = null;
    courseStatus.value = null;

    try {
      const created = await learningGateway.createCourse(
        trimmed,
        inputGoal,
        inputExtras,
      );
      pendingCourseId.value = created.course_id;

      // 立即 GET 一次,可能后端同步生成好,直接拿到 ready 走 fast-path。
      const initial = await learningGateway.getCourse(created.course_id);
      const result = await pollUntilSettled(created.course_id, initial);
      return result;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '课程生成失败,请稍后重试';
      error.value = msg;
      throw e instanceof Error ? e : new Error(msg);
    } finally {
      submitting.value = false;
    }
  }

  /**
   * 轮询主循环。`initial` 是 submitTopic 里的 fast-path 探针,可以省一次
   * setInterval 启动开销。返回时一定停在 ready 或 failed,且 timer 已清。
   */
  function pollUntilSettled(
    courseId: string,
    initial: CourseStatusResponse,
  ): Promise<SubmittedCourse> {
    return new Promise((resolve, reject) => {
      pollStartedAt = Date.now();

      const settle = (resp: CourseStatusResponse) => {
        stopPolling();
        if (resp.status === 'ready') {
          course.value = resp.course;
          courseStatus.value = 'ready';
          pendingCourseId.value = null;
          resolve({ course_id: courseId, course: resp.course });
        } else if (resp.status === 'failed') {
          courseStatus.value = 'failed';
          pendingCourseId.value = null;
          const msg = '课程生成失败,请稍后再试';
          error.value = msg;
          reject(new Error(msg));
        } else {
          // pending —— 继续轮询
        }
      };

      settle(initial);

      if (initial.status === 'pending') {
        pollTimer = setInterval(async () => {
          if (Date.now() - pollStartedAt > POLL_TIMEOUT_MS) {
            stopPolling();
            courseStatus.value = 'failed';
            pendingCourseId.value = null;
            const msg = '课程生成超时,请稍后重试';
            error.value = msg;
            reject(new Error(msg));
            return;
          }
          try {
            const resp = await learningGateway.getCourse(courseId);
            if (resp.status !== 'pending') settle(resp);
          } catch (e: unknown) {
            stopPolling();
            const msg =
              e instanceof Error
                ? `轮询失败: ${e.message}`
                : '轮询失败,请稍后重试';
            error.value = msg;
            reject(e instanceof Error ? e : new Error(msg));
          }
        }, POLL_INTERVAL_MS);
      }
    });
  }

  /**
   * 装载已 ready 的课程包(用于直接访问 /learning/course/:id 的场景)。
   * 遇到 pending 自动启动轮询;遇到 failed 抛错。
   *
   * 与 submitTopic 不同:`submitting` 不会被设为 true,以免 UI 误把它当成
   * 主题生成态;pending 期间的 loading 提示由调用方自行展示。
   */
  async function loadCourse(courseId: string): Promise<LearningCourse | null> {
    stopPolling();
    error.value = null;
    try {
      const initial = await learningGateway.getCourse(courseId);
      if (initial.status === 'ready') {
        course.value = initial.course;
        courseStatus.value = 'ready';
        return initial.course;
      }
      if (initial.status === 'failed') {
        courseStatus.value = 'failed';
        const msg = '课程生成失败,请稍后再试';
        error.value = msg;
        throw new Error(msg);
      }
      // pending —— 启动轮询,settle 后会自动写入 course.value
      const result = await pollUntilSettled(courseId, initial);
      return result.course;
    } catch (e: unknown) {
      if (e instanceof Error) throw e;
      const msg = '加载课程失败';
      error.value = msg;
      throw new Error(msg);
    }
  }

  /**
   * 渐进产出：触发后端生成下一课。语义（task-352）：
   *   - `status: 'pending'`：后端已入队（kiq），调用方需继续轮询
   *     `getCourse(courseId)` 直到 `lessons` 列表增长到目标 lesson 数。
   *   - `status: 'already_generated'`：API 同步预检命中（学员已生成过），
   *     **没**真正排队；调用方只需重新 `loadCourse` 拿到最新 lessons。
   *   - `status: 'failed'`：课程不存在 / 课程状态为 failed。抛错。
   *
   * 本函数只负责触发；轮询 lessons 增长请用 `pollForLesson`。两段逻辑
   * 拆开让 LessonView 能独立控制"等待"文案与跳转时机。
   */
  async function generateNextLesson(
    courseId: string,
  ): Promise<NextLessonResponse> {
    try {
      const resp = await learningGateway.generateNextLesson(courseId);
      // 同时刷新 progressList（如果该课程项存在），让 next_session 同步。
      try {
        const fresh = await learningGateway.listProgress();
        progressList.value = fresh;
      } catch {
        // 静默 — listProgress 失败不影响 generate 的成功语义
      }
      return resp;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '生成下一课失败,请稍后再试';
      error.value = msg;
      throw e instanceof Error ? e : new Error(msg);
    }
  }

  /**
   * 在 generateNextLesson 返回 `pending` 后调用:轮询 `getCourse` 直到
   * `lessons.length >= targetLessonCount`(通常是 next_lesson 编号,或当前
   * length+1)。settle 后自动更新 course.value。
   *
   * 超时 180s(单课生成通常 10–30s,180s 足够覆盖冷启动/长 prompt)。
   */
  function pollForLesson(
    courseId: string,
    targetLessonCount: number,
  ): Promise<LearningCourse | null> {
    return new Promise((resolve, reject) => {
      stopPolling();
      pollStartedAt = Date.now();

      const settle = (c: LearningCourse | null) => {
        stopPolling();
        resolve(c);
      };

      // fast-path:当前 course 已经够了就直接返回
      if (
        course.value &&
        course.value.course_id === courseId &&
        course.value.lessons.length >= targetLessonCount
      ) {
        settle(course.value);
        return;
      }

      pollTimer = setInterval(async () => {
        if (Date.now() - pollStartedAt > LESSON_POLL_TIMEOUT_MS) {
          stopPolling();
          const msg = '下一课生成超时,请稍后再试';
          error.value = msg;
          reject(new Error(msg));
          return;
        }
        try {
          const resp = await learningGateway.getCourse(courseId);
          if (resp.status === 'failed') {
            stopPolling();
            const msg = '课程状态异常,无法生成下一课';
            error.value = msg;
            reject(new Error(msg));
            return;
          }
          if (resp.status === 'ready') {
            course.value = resp.course;
            courseStatus.value = 'ready';
            if (resp.course.lessons.length >= targetLessonCount) {
              settle(resp.course);
            }
          }
          // pending —— 继续轮询
        } catch (e: unknown) {
          stopPolling();
          const msg =
            e instanceof Error
              ? `轮询失败: ${e.message}`
              : '轮询失败,请稍后重试';
          error.value = msg;
          reject(e instanceof Error ? e : new Error(msg));
        }
      }, POLL_INTERVAL_MS);
    });
  }

  /** 拉取进度列表。失败时静默(列表空态即可)。 */
  async function loadProgress() {
    progressLoading.value = true;
    try {
      progressList.value = await learningGateway.listProgress();
    } catch {
      progressList.value = [];
    } finally {
      progressLoading.value = false;
    }
  }

  /**
   * 拉取可用学习模型（task-391）：前端下拉的数据源。
   *
   * 失败时静默回退到 `FALLBACK_MODELS`（单条 flash），不阻塞主题提交：
   * 模型下拉至少有一个可选选项，匿名用户也能继续走默认 flash。
   */
  async function loadModels() {
    modelsLoading.value = true;
    try {
      models.value = await learningGateway.listModels();
    } catch {
      models.value = [...FALLBACK_MODELS];
    } finally {
      modelsLoading.value = false;
    }
  }

  /** 标记某一节完成。返回后端下发的最新进度项;失败抛错。 */
  async function markSessionDone(
    courseId: string,
    session: number,
  ): Promise<LearningProgressItem> {
    try {
      const updated = await learningGateway.markProgress(courseId, {
        session_done: session,
      });
      upsertProgress(updated);
      return updated;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '标记进度失败,请稍后再试';
      error.value = msg;
      throw e instanceof Error ? e : new Error(msg);
    }
  }

  /** 标记所有练习完成。返回后端下发的最新进度项;失败抛错。 */
  async function markExerciseDone(
    courseId: string,
  ): Promise<LearningProgressItem> {
    try {
      const updated = await learningGateway.markProgress(courseId, {
        exercise_done: true,
      });
      upsertProgress(updated);
      return updated;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '标记进度失败,请稍后再试';
      error.value = msg;
      throw e instanceof Error ? e : new Error(msg);
    }
  }

  /** 在进度列表中 upsert 一项(按 course_id 去重)。 */
  function upsertProgress(item: LearningProgressItem) {
    const idx = progressList.value.findIndex(
      (p) => p.course_id === item.course_id,
    );
    if (idx >= 0) {
      // 用新数组替换以触发响应式 (Vue3 ref 数组的索引赋值需 $set 等价手法)
      progressList.value = [
        ...progressList.value.slice(0, idx),
        item,
        ...progressList.value.slice(idx + 1),
      ];
    } else {
      progressList.value = [item, ...progressList.value];
    }
  }

  /** 清空错误(UI 给用户提供一个"知道了"按钮时调用)。 */
  function clearError() {
    error.value = null;
  }

  /**
   * 辅助 helper:在已经装载的 course 里按 id 找 lesson。
   * 找不到返回 undefined;组件用可选链即可。
   */
  function findLesson(lessonId: number): LearningLesson | undefined {
    return course.value?.lessons.find((l) => l.id === lessonId);
  }

  // 组件销毁时自动停轮询,避免写已卸载的反应式数据。
  onUnmounted(() => {
    stopPolling();
  });

  return {
    // 状态
    pendingCourseId,
    submitting,
    error,
    course,
    courseStatus,
    progressList,
    progressLoading,
    models,
    modelsLoading,
    // 行为
    submitTopic,
    loadCourse,
    loadProgress,
    loadModels,
    generateNextLesson,
    pollForLesson,
    markSessionDone,
    markExerciseDone,
    findLesson,
    clearError,
  };
}
