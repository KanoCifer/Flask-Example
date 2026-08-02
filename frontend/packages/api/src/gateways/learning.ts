import { apiClient } from '../apiClient';
import { getAnonId } from '@readinglist/utils';
import type {
  CourseStatusResponse,
  LearningProgressItem,
  NextLessonResponse,
} from '@readinglist/types';

// ── Learning 网关 ────────────────────────────────────────────────────────────
//
// 对齐 `backend/app/api/v2/learning.py` 的 8 个端点（task-337 + task-352 +
// task-385 下载）。URL 前缀沿用项目惯例：`v2/...`，不带前导斜杠（见
// `fishing.ts` / `rss.ts`）。响应统一以 `APIResponse` 信封下发，网关解包
// `.data.data` 后吐出领域数据（下载端点除外——直接拿 blob）。
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
  /**
   * 下载整门课程的原始 md 制品为 ZIP（task-385）。
   * 触发浏览器下载，默认文件名为 `<course_id>.zip`，可用 `filename` 覆盖。
   * 失败（404 等）会 reject，由调用方决定如何提示。
   */
  downloadBundle(courseId: string, filename?: string): Promise<void>;
  /**
   * 下载课程内单个原始 md 文件（task-385）。
   * `relPath` 形如 `lessons/0001-foo.md`（正斜杠），默认文件名取其末段
   * basename；失败（越界 / 非 owner / 缺失）会 reject。
   */
  downloadFile(courseId: string, relPath: string, filename?: string): Promise<void>;
  /** 列出课程包内的全部原始 md 制品（task-385，「原始文件」面板的数据源）。 */
  listFiles(courseId: string): Promise<CourseFileEntry[]>;
}

/** 「原始文件」面板的单行条目（``GET /v2/learning/courses/{id}/files``）。 */
export interface CourseFileEntry {
  name: string;
  rel_path: string;
  size: number;
  mtime: number;
}

/** 给匿名请求附加 `X-Anon-Id` 头。已登录用户的 Authorization 由拦截器处理。 */
function anonIdHeaders(): { headers: Record<string, string> } {
  return { headers: { 'X-Anon-Id': getAnonId() } };
}

/**
 * 把 blob 保存为本地文件（anchor + createObjectURL + revoke 三件套）。
 *
 * 泛化自 `useImageProcessor.download`（apps/vue-app/.../useImageProcessor.ts:141），
 * 供 `downloadBundle` / `downloadFile` 及 Vue 组件层复用，避免每处重写。
 * revoke 延迟到点击之后，避免部分浏览器提前释放导致下载失败。
 */
export function saveBlobAs(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
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

  async downloadBundle(courseId: string, filename?: string): Promise<void> {
    await downloadBlob(
      `v2/learning/courses/${courseId}/bundle.zip`,
      `${courseId}.zip`,
      filename,
    );
  },

  async downloadFile(
    courseId: string,
    relPath: string,
    filename?: string,
  ): Promise<void> {
    const defaultName = relPath.split('/').pop() ?? relPath;
    await downloadBlob(
      `v2/learning/courses/${courseId}/files/${relPath}`,
      defaultName,
      filename,
    );
  },

  async listFiles(courseId: string): Promise<CourseFileEntry[]> {
    const res = await apiClient.get<{ data: { items: CourseFileEntry[] } }>(
      `v2/learning/courses/${courseId}/files`,
      anonIdHeaders(),
    );
    return res.data.data.items;
  },
};

/** GET blob 并触发浏览器下载（downloadBundle / downloadFile 共用）。 */
async function downloadBlob(
  url: string,
  defaultName: string,
  filename?: string,
): Promise<void> {
  const res = await apiClient.get<Blob>(url, {
    ...anonIdHeaders(),
    responseType: 'blob',
  });
  saveBlobAs(res.data, filename ?? defaultName);
}

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
