// AI 域类型（AI 总结 / 对话 / 天气分析）— 跨切面能力，被 features/ai 消费。

export interface StreamSummaryBody {
  title: string;
  content: string;
  model: string;
}

export interface StreamChatBody {
  message: string;
  session_id: string;
  article_content?: string;
  article_title?: string;
}

export interface WeatherAnalysisBody {
  weather_data: unknown;
  model_id: string;
}

export interface AiStreamFrame {
  content?: string;
  is_end?: boolean;
}
