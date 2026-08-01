// Learning 域桶导出 —— 课程生成 / 进度追踪 / 客户端判分 UI

export {
  LearningList,
  CourseView,
  LessonView,
  ExerciseCard,
} from './components';
export { useLearningCourse } from './composables/useLearningCourse';
export type { SubmittedCourse } from './composables/useLearningCourse';

export { learningGateway } from './api';
export type {
  LearningGateway,
  ProgressPatchBody,
  CourseCreateResponse,
} from './api';
export type {
  LearningCourse,
  LearningLesson,
  Exercise,
  ExerciseOption,
  ExerciseType,
  CourseStatus,
  CourseStatusResponse,
  LearningProgressItem,
  NextLessonResponse,
  NextLessonStatus,
} from '@readinglist/types';