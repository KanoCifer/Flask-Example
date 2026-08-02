// Learning API 网关桶导出 (课程生成 + 进度追踪 + 渐进产出)
// 转发到 @readinglist/api 的 learningGateway;客户端判分逻辑在前端。
// 类型从 @readinglist/types 直接导入 —— 见 frontend/packages/api/src/index.ts,
// 该桶未 re-export learning 类型。

export { learningGateway } from '@readinglist/api';
export type {
  LearningGateway,
  ProgressPatchBody,
  CourseCreateResponse,
  CourseFileEntry,
} from '@readinglist/api';

export type {
  LearningCourse,
  Exercise,
  ExerciseOption,
  ExerciseType,
  CourseStatus,
  CourseStatusResponse,
  LearningProgressItem,
  NextLessonResponse,
  NextLessonStatus,
} from '@readinglist/types';