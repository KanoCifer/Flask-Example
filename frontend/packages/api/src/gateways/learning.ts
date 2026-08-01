import { apiClient } from '../apiClient';
import { getAnonId } from '@readinglist/utils';
import type {
  CourseStatusResponse,
  LearningProgressItem,
  NextLessonResponse,
} from '@readinglist/types';

// ── Learning 网关 ────────────────────────────────────────────────────────────
//
// 对齐 `backend/app/api/v2/learning.py` 的 5 个端点（task-337 + task-352）。
// URL 前缀沿用项目惯例：`v2/...`，不带前导斜杠（见 `fishing.ts` / `rss.ts`）。
// 响应统一以 `APIResponse` 信封下发，网关解包 `.data.data` 后吐出领域数据。
//
// 匿名用户的 owner key 由 `X-Anon-Id` 头携带，前端在每个请求都附加
// `getAnonId()`（localStorage 持久化的 UUID）。登录用户的 Authorization 头
// 仍由 `apiClient` 请求拦截器自动注入。

/** `PATCH /v2/learning/progress/{course_id}` 的请求体。 */
export interface ProgressPatchBody {
  session_done?: number;
  exercise_done?: boolean;
}

/** `POST /v2/learning/courses` 返回的极简确认包。 */
export interface CourseCreateResponse {
  course_id: string;
  status: 'pending';
}

export interface LearningGateway {
  /**
   * 提交主题，异步生成课程包；返回 `pending` 状态供前端轮询。
   * @param topic 学习主题
   * @param goal 学习目标（可选），后端用于组织 MISSION.md 具体文案。
   */
  createCourse(topic: string, goal?: string): Promise<CourseCreateResponse>;
  /** 轮询课程状态：`pending` / `ready` / `failed`。 */
  getCourse(courseId: string): Promise<CourseStatusResponse>;
  /**
   * 渐进产出（task-352）：触发生成下一课。返回的 `status` 三态：
   * - `pending`：后台已 kiq 任务，继续轮询 `getCourse` 等 lessons 列表增长；
   * - `already_generated`：API 同步预检命中，**没**真正排队任务；
   * - `failed`：课程不存在 / 状态为 failed。
   */
  generateNextLesson(courseId: string): Promise<NextLessonResponse>;
  /** 列出当前 owner 的全部课程进度。 */
  listProgress(): Promise<LearningProgressItem[]>;
  /** 标记 session_done / exercise_done（任一字段可独立更新）。 */
  markProgress(
    courseId: string,
    body: ProgressPatchBody,
  ): Promise<LearningProgressItem>;
}

/** 给匿名请求附加 `X-Anon-Id` 头。已登录用户的 Authorization 由拦截器处理。 */
function anonIdHeaders(): { headers: Record<string, string> } {
  return { headers: { 'X-Anon-Id': getAnonId() } };
}

export const learningGateway: LearningGateway = {
  async createCourse(topic: string, goal?: string): Promise<CourseCreateResponse> {
    const body: Record<string, string> = { topic };
    if (goal && goal.trim()) body.goal = goal.trim();
    const res = await apiClient.post<{ data: CourseCreateResponse }>(
      'v2/learning/courses',
      body,
      anonIdHeaders(),
    );
    return res.data.data;
  },

  async getCourse(courseId: string): Promise<CourseStatusResponse> {
    const res = await apiClient.get<{ data: CourseStatusResponse }>(
      `v2/learning/courses/${courseId}`,
      anonIdHeaders(),
    );
    return res.data.data;
  },

  async generateNextLesson(courseId: string): Promise<NextLessonResponse> {
    const res = await apiClient.post<{ data: NextLessonResponse }>(
      `v2/learning/courses/${courseId}/lessons`,
      undefined,
      anonIdHeaders(),
    );
    return res.data.data;
  },

  async listProgress(): Promise<LearningProgressItem[]> {
    const res = await apiClient.get<{ data: { items: LearningProgressItem[] } }>(
      'v2/learning/progress',
      anonIdHeaders(),
    );
    return res.data.data.items;
  },

  async markProgress(
    courseId: string,
    body: ProgressPatchBody,
  ): Promise<LearningProgressItem> {
    const res = await apiClient.patch<{ data: LearningProgressItem }>(
      `v2/learning/progress/${courseId}`,
      body,
      anonIdHeaders(),
    );
    return res.data.data;
  },
};

// ── 便利 re-export ─────────────────────────────────────────────────────────
export type {
  LearningCourse,
  Exercise,
  ExerciseOption,
  CourseStatus,
  CourseStatusResponse,
  LearningProgressItem,
  NextLessonResponse,
  NextLessonStatus,
} from '@readinglist/types';
