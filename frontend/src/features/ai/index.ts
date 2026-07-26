// AI 域桶导出 — 跨切面能力，被 blog / rss / fishing 三个 feature 共享。

export { default as AiCompanion } from './components/AiCompanion.vue';

export { useAiCompanion, MODEL_OPTIONS } from './composables/useAiCompanion';
export type {
  AiContext,
  MessageKind,
  AiMessage,
} from './composables/useAiCompanion';

export { aiGateway } from './api/aiGateway';
export type { AiGateway } from './api/aiGateway';
