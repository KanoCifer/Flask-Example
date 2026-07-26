// 统计（Analytics）领域类型

export interface AnalyticsOverviewData {
  status?: string;
  code?: number;
  data: Record<string, unknown>;
  message?: string;
}

export interface PostViewData {
  title: string;
  views: number;
}
