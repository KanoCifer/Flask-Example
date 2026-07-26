// DevTask（开发任务）领域类型 —— 与后端 document/dev_task.go 对齐

export type DevTaskType = '问题' | '功能需求' | '优化' | '技术债';

export type DevTaskPriority = 'P0 紧急' | 'P1 高' | 'P2 中' | 'P3 低';

// Scope 去 enum 化：后端接受任意"<层>-<技术>"格式字符串。前端保留为 string，
// 但给出常见值作为 placeholder / 提示，不再是闭枚举。
export type DevTaskScope = string;

export type DevTaskStatus =
  '待评估' | '待排期' | '进行中' | '已搁置' | '已完成';

// 任务角色 —— 对应后端 TaskKind。空串 = spec（老文档兜底），前端显示时按 spec 处理。
export type DevTaskKind = 'spec' | 'subtask';

export interface DevTask {
  id: string;
  user_id: number;
  title: string | null;
  description?: string | null;
  detail?: string | null;
  type: DevTaskType;
  priority: DevTaskPriority;
  scope: DevTaskScope;
  status: DevTaskStatus;
  sort_order: number;
  due_date?: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  // Spec
  acceptance_criteria?: string | null;
  constraints?: string | null;
  context_pointers?: string | null;
  // Who / Dependencies
  for_agent?: boolean;
  blocked_by?: string[];
  // Slug —— task-N，人类可读引用（后端操作标识，所有路由以 slug 定位任务）
  slug: string;
  // 任务角色：spec（可拆解为子任务）/ subtask（spec 拆解出的子任务）。空串 = spec。
  kind?: DevTaskKind;
  // 子任务归属的 spec slug。spec / 独立任务为 null。
  parent_slug?: string | null;
}

export interface Pagination {
  page: number;
  per_page: number;
  total: number;
  pages: number;
  has_prev: boolean;
  has_next: boolean;
  prev_num?: number | null;
  next_num?: number | null;
}

export interface DevTaskListResponse {
  tasks: DevTask[];
  pagination: Pagination;
}

export interface ListDevTasksParams {
  page?: number;
  per_page?: number;
  status?: DevTaskStatus;
  priority?: DevTaskPriority;
  type?: DevTaskType;
  for_agent?: boolean;
  include_deleted?: boolean;
}

export interface CreateDevTaskPayload {
  title: string;
  description?: string | null;
  detail?: string | null;
  type: DevTaskType;
  priority: DevTaskPriority;
  scope: DevTaskScope;
  due_date?: string | null;
  // Spec
  acceptance_criteria?: string | null;
  constraints?: string | null;
  context_pointers?: string | null;
  // Who / Dependencies
  for_agent?: boolean;
  blocked_by?: string[];
  // 任务角色 / 结构归属
  kind?: DevTaskKind;
  parent_slug?: string | null;
}

export interface UpdateDevTaskPayload {
  title?: string | null;
  description?: string | null;
  detail?: string | null;
  type?: DevTaskType;
  priority?: DevTaskPriority;
  scope?: DevTaskScope;
  status?: DevTaskStatus;
  sort_order?: number;
  due_date?: string | null;
  // Spec
  acceptance_criteria?: string | null;
  constraints?: string | null;
  context_pointers?: string | null;
  // Who / Dependencies
  for_agent?: boolean;
  blocked_by?: string[];
  // 任务角色 / 结构归属
  kind?: DevTaskKind;
  parent_slug?: string | null;
}

// MCP / 长期服务 token 响应
export interface McpTokenResult {
  token: string;
  expires_at: string;
  days: number;
}
