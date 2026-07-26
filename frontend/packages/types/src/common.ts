// ── 跨领域基础类型 ──────────────────────────────────────────────────────────

/** 后端统一响应信封（Go / Python 两端一致） */
export interface ApiResponse<T = unknown> {
  status: string;
  message: string;
  data?: T;
}

/** 通用分页元数据 */
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
