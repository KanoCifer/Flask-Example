// 过渡期 re-export — devtask API 已迁移到 @readinglist/api
export { devTaskGateway } from '@readinglist/api';
export type { DevTaskGateway } from '@readinglist/api';

// DevTask 领域类型 —— 真源在 @readinglist/types，桶重新导出以保持兼容
export type {
  CreateDevTaskPayload,
  DevTask,
  DevTaskKind,
  DevTaskListResponse,
  DevTaskPriority,
  DevTaskScope,
  DevTaskStatus,
  DevTaskType,
  ListDevTasksParams,
  McpTokenResult,
  Pagination,
  UpdateDevTaskPayload,
} from '@readinglist/types';
