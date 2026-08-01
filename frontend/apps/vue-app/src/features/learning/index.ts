// Learning 域桶导出 —— 课程生成 / 进度追踪 / 客户端判分 UI

export {
  LearningList,
  CourseView,
  LessonView,
  MissionCard,
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
  Mission,
  MissionOption,
  MissionType,
  CourseStatus,
  CourseStatusResponse,
  LearningProgressItem,
  NextLessonResponse,
  NextLessonStatus,
} from '@readinglist/types';