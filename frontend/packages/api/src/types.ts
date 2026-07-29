/** 后端 API 响应信封 — 所有端点统一返回 { message, data, code?, errors? } */
export interface ApiResponse<T = unknown> {
  message: string;
  data: T;
  code?: number;
  errors?: Record<string, unknown>;
}
