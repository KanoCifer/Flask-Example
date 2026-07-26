// AI 域类型（AI 总结 / 对话 / 天气分析）— 跨切面能力，被 features/ai 消费。

export interface StreamThreadBody {
  mode: 'summary' | 'chat';
  message?: string;
  session_id?: string;
  article_content?: string;
  article_title?: string;
  model?: string;
}

export interface WeatherAnalysisBody {
  weather_data: unknown;
  model_id: string;
}

/** 单包流通道标识 —— 'reasoning' 为 AI 思考过程，'content' 为正文 delta。缺省视为 'content'（向后兼容）。 */
export type AiStreamFrameType = 'reasoning' | 'content';

export interface AiStreamFrame {
  content?: string;
  is_end?: boolean;
  type?: AiStreamFrameType;
}
