// ── Learning 域类型（课程生成 + 进度追踪）────────────────────────────────────
//
// 与 `backend/app/schemas/learning.py` 对齐（task-337 后端契约）。
// 网关 `@readinglist/api/gateways/learning` 负责解包 `APIResponse` 信封，
// 消费方拿到的就是这里的形状。

/** 选择题单选题选项 */
export interface ExerciseOption {
  key: string;
  text: string;
}

/** 题型字面量 */
export type ExerciseType = 'single_choice' | 'multi_choice' | 'true_false';

/** 课程生成状态字面量 */
export type CourseStatus = 'pending' | 'ready' | 'failed';

/** 单个练习题（来自 exercise.md 解析） */
export interface Exercise {
  id: number;
  type: ExerciseType;
  difficulty: number;
  points: number;
  prompt: string;
  /** 选择题必有；判断题恒为 `null` */
  options: ExerciseOption[] | null;
  /** 单选 `string` / 多选 `string[]` / 判断 `boolean` */
  answer: string | string[] | boolean;
  explanation: string;
}

/** 单个课程（teach skill 对齐：一课一文件） */
export interface LearningLesson {
  id: number;
  title: string;
  slug: string;
  /** 该课正文全文 */
  md: string;
  /** 该课练习（解析自 `<num>-<slug>.exercise.md` 的 front matter） */
  exercises: Exercise[];
}

/** 完整课程包（`ready` 时随 `GET /courses/{id}` 一起下发） */
export interface LearningCourse {
  course_id: string;
  topic: string;
  /** 已生成的课（渐进产出时列表增长） */
  lessons: LearningLesson[];
  resource_md: string;
  /** 学习使命文档（MISSION.md 全文）；缺失（旧课程 / 未生成）为 `null` */
  mission_md: string | null;
}

/** 课程进度项（来自 `GET /v2/learning/progress`） */
export interface LearningProgressItem {
  course_id: string;
  topic: string;
  sessions_done: number[];
  exercise_done: boolean;
  status: CourseStatus;
  next_session: number | null;
}

/** `GET /v2/learning/courses/{course_id}` 的按状态判别的响应 */
export type CourseStatusResponse =
  | { status: 'pending'; course_id: string }
  | { status: 'ready'; course: LearningCourse }
  | { status: 'failed'; course_id: string };

/** `POST /v2/learning/courses/{course_id}/lessons` (task-352) 的响应字面量。 */
export type NextLessonStatus = 'pending' | 'already_generated' | 'failed';

/**
 * 单个可用学习模型（来自 `GET /v2/learning/models`，task-391）。
 *
 * `is_premium === true` 时前端应在未登录状态下禁用选项；登录用户可正常
 * 选择。后端白名单 (`LEARNING_MODELS`) 与 generator 同源，前端无需单独
 * 维护常量列表。
 */
export interface LearningModel {
  /** 后端白名单 key，例如 `deepseek-v4-flash` / `deepseek-v4-pro`。 */
  id: string;
  /** 展示用文案（任务 391 后端已对齐 i18n key，前端直接显示）。 */
  label: string;
  /** 仅登录用户可用的模型 — 未登录用户禁选并提示登录。 */
  is_premium: boolean;
}

/** `POST /v2/learning/courses/{course_id}/lessons` 的响应。 */
export interface NextLessonResponse {
  course_id: string;
  /** 预期/已生成的新课编号；幂等命中或失败时为 `null`。 */
  next_lesson: number | null;
  status: NextLessonStatus;
}
