<!--
  AiCompanion — "The Briefing"

  THESIS: a unified AI reading companion. The summary is no longer a separate
  mode — it is the thread's opening turn (a "briefing" artifact), and every
  follow-up question appends beneath it. One surface, one input, one model
  picker. Refuses the generic chat-widget look; reads like a curator's note.

  OWN-WORLD: Curated Shelf tokens — OKLCH semantic classes, border-as-shadow,
  spring motion, serif-for-headings. The briefing panel is the one chromatic
  moment (accent top rule + "摘要" kicker); everything else stays matte/tonal.

  STORY: visitor lands, sees an inviting prompt + "生成摘要" hero. The AI
  streams a briefing panel (typewriter), then the input returns for follow-ups.
  Model selector lives in the header; 清空 resets the thread.

  FIRST VIEWPORT: header (mark + "AI 阅读伴侣" + model picker/clear) over an
  empty-state hero (glow mark, prompt line, primary "生成摘要 →" button), with
  the input bar pinned to the bottom.

  FORM: unified-flow conversation surface; summary = first assistant turn,
  distinct from chat turns; seed key concept-seed dealt this direction.
-->
<script setup lang="ts">
import { AnimatePresence, motion } from 'motion-v';
import { computed, ref } from 'vue';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
} from '@lucide/vue';
import { SPRING_BOUNCE } from '@/constants';
import { renderMarkdown } from '@/composables';
import { Button, HoverDropdown } from '@/components';
import { useNotificationStore } from '@/stores';
import {
  useAiCompanion,
  type AiMessage,
} from '@/features/ai/composables/useAiCompanion';

defineOptions({ name: 'AiCompanion' });

const props = defineProps<{
  title?: string;
  content: string;
}>();

const notifier = useNotificationStore();

const {
  messages,
  input,
  loading,
  error,
  model,
  modelOptions,
  hasContent,
  canSend,
  canGenerate,
  bindContainer,
  generateBriefing,
  send,
  onKeydown,
  cancel,
} = useAiCompanion({ title: props.title, content: props.content });

const briefing = computed(() =>
  messages.value.find((m) => m.kind === 'briefing'),
);
const renderedBriefing = computed(() =>
  briefing.value ? renderMarkdown(briefing.value.content) : '',
);
const lastMsg = computed(() => messages.value[messages.value.length - 1]);

const modelLabel = computed(
  () => modelOptions.find((o) => o.value === model.value)?.label ?? model.value,
);

function pickModel(value: string, close?: () => void) {
  model.value = value;
  close?.();
}

function rendered(msg: AiMessage) {
  return renderMarkdown(msg.content);
}

/**
 * Reasoning 折叠区状态。
 *
 * 行为契约：
 * - 自动态：content 为空时展开；content 一旦有 delta 自动收起。
 * - 手动态：用户点击 toggle 后按用户选择固定，直到该消息被清掉。
 * - reasoning 走普通流式累加，不进 typewriter（仅 content 走打字机效果）。
 *
 * key=msg.id 而非 Array index；消息可能被 unshift / splice，保持稳定引用。
 *
 * Per-message override map: undefined = 跟随自动态；boolean = 用户手动锁定。
 */
const reasoningOverrides = ref<Map<string, boolean>>(new Map());

function isReasoningOpen(msg: AiMessage): boolean {
  const override = reasoningOverrides.value.get(msg.id);
  if (override !== undefined) return override;
  return !msg.content;
}

function toggleReasoning(msg: AiMessage) {
  const cur = isReasoningOpen(msg);
  const next = new Map(reasoningOverrides.value);
  next.set(msg.id, !cur);
  reasoningOverrides.value = next;
}
</script>

<template>
  <section
    class="from-card/70 via-card/50 to-accent/[0.04] shadow-accent/[0.06] ring-accent/[0.08] mb-6 overflow-hidden rounded-2xl bg-gradient-to-br shadow-sm ring-1 backdrop-blur-md motion-reduce:backdrop-blur-none"
  >
    <!-- 辉光层：icon 背后的呼吸光晕，生成时脉冲加速 -->
    <div class="relative">
      <div
        class="bg-accent/30 pointer-events-none absolute top-0 left-6 h-16 w-16 rounded-full blur-2xl"
        :class="loading ? 'animate-glow-pulse' : 'animate-glow-breathe'"
        aria-hidden="true"
      />

      <!-- Header -->
    </div>

    <!-- Error -->
    <p v-if="error" class="text-destructive px-5 pb-3 text-sm">
      {{ error }}
    </p>

    <!-- Thread -->
    <div
      :ref="bindContainer"
      class="max-h-[50vh] space-y-3 overflow-y-auto px-5 py-4"
    >
      <!-- Empty state: the invitation -->
      <AnimatePresence>
        <motion.div
          v-if="!hasContent"
          key="empty"
          :initial="{ opacity: 0, y: 8 }"
          :animate="{ opacity: 1, y: 0 }"
          :exit="{ opacity: 0, y: -8 }"
          :transition="{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }"
          class="bg-surface/20 flex flex-col items-center gap-4 rounded-xl px-6 py-8 text-center"
        >
          <div class="relative flex items-center justify-center">
            <div
              class="bg-accent/20 absolute h-16 w-16 rounded-full blur-2xl"
              :class="loading ? 'animate-glow-pulse' : 'animate-glow-breathe'"
              aria-hidden="true"
            />
            <svg
              width="40"
              height="40"
              class="text-blue-600"
              viewBox="0 0 56 56"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M23.0837 4.14727C23.4047 3.94871 23.8119 3.94526 24.1139 4.17071L29.7956 6.88457C30.0573 7.08052 30.0169 7.47596 29.7311 7.63164C21.9807 11.8619 17.302 15.9874 14.8425 19.9949C13.2514 22.5852 10.3251 29.6555 12.9733 36.0359C15.716 42.6364 21.9322 45.0203 26.5329 45.0203C30.0087 45.0203 32.3712 43.9761 34.7712 42.3523C41.2785 37.9448 42.0285 29.3468 37.1852 23.4334V23.4305C37.2025 23.4453 39.8831 25.7483 41.5759 29.2352C41.2532 28.0697 40.7733 26.9511 40.1374 25.909C38.7028 23.5552 36.7695 21.5823 34.0407 20.2107C27.9675 17.1587 15.2951 18.6299 13.2995 31.7693C13.5017 22.6565 19.5393 16.9388 25.0056 15.1697C28.0421 14.1873 31.2569 13.9996 34.2907 14.5418C38.3385 11.2644 42.8127 9.79064 44.4147 9.33965C44.7842 9.23496 45.1834 9.33932 45.4557 9.61309C45.9141 10.0747 46.7149 10.8772 47.7341 11.8836H47.7399C48.0446 12.1842 47.8852 12.7025 47.4645 12.783C43.5274 13.5426 40.839 14.2947 37.9968 15.6072C41.4431 17.0031 44.3933 19.4488 46.1921 22.8201C46.4048 23.2172 46.2189 23.7081 45.7956 23.8611L43.3874 24.7332C45.5043 28.3329 46.0487 32.7462 45.0104 37.2664C43.2467 44.9513 37.3384 50.3896 29.7956 51.6834C28.6146 51.8848 27.444 52.0193 26.2927 51.9979C25.9026 51.9909 25.5967 51.6853 25.569 51.3162C25.4877 51.1735 25.4521 51.0025 25.4831 50.826L25.945 48.2361C23.8389 48.0884 21.8642 47.7391 19.8874 46.9393C8.15393 42.188 6.92433 30.5948 8.60711 23.5701C10.7915 14.4599 17.5068 7.55894 23.0837 4.14727Z"
                fill="currentColor"
              ></path>
            </svg>
          </div>
          <p class="text-ink text-sm leading-relaxed">
            点击「生成总结」，快速提炼文章核心要点
          </p>
          <Button
            size="md"
            :disabled="!canGenerate"
            @click="generateBriefing(notifier.error)"
          >
            <Loader2
              v-if="loading"
              class="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            生成总结
          </Button>
          <p class="text-muted text-xs">也可以直接在下方输入你的问题</p>
        </motion.div>
      </AnimatePresence>

      <!-- Messages -->
      <template v-for="(msg, idx) in messages" :key="msg.id">
        <!-- Briefing: the opening summary artifact -->
        <motion.div
          v-if="msg.kind === 'briefing'"
          :initial="{ opacity: 0, scale: 0.96, y: 8 }"
          :animate="{ opacity: 1, scale: 1, y: 0 }"
          :transition="SPRING_BOUNCE"
          class="border-accent/20 bg-surface/30 min-h-80 rounded-2xl border-t-2 px-5 py-4"
        >
          <div class="mb-3 flex items-center gap-2">
            <span
              class="text-accent text-[11px] font-semibold tracking-[0.14em] uppercase"
              >摘要</span
            >
            <span class="text-muted text-xs">· {{ modelLabel }}</span>
            <button
              type="button"
              class="text-muted hover:text-ink focus-visible:ring-ring/40 ml-auto cursor-pointer text-xs transition-colors focus:outline-none focus-visible:ring-2"
              :disabled="loading"
              @click="generateBriefing(notifier.error)"
            >
              重新生成
            </button>
          </div>
          <!-- 思考过程（仅在 msg.reasoning 非空时渲染） -->
          <div v-if="msg.reasoning" class="border-ink/10 mb-2 border-b pb-2">
            <button
              type="button"
              class="text-muted hover:text-ink focus-visible:ring-ring/40 inline-flex cursor-pointer items-center gap-1 text-xs transition-colors focus:outline-none focus-visible:ring-2"
              :aria-expanded="isReasoningOpen(msg)"
              @click="toggleReasoning(msg)"
            >
              <ChevronRight
                class="h-3 w-3 shrink-0 transition-transform duration-200 motion-reduce:transition-none"
                :class="isReasoningOpen(msg) && 'rotate-90'"
                aria-hidden="true"
              />
              <span>思考过程</span>
            </button>
            <Transition
              enter-active-class="transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none motion-reduce:duration-0"
              enter-from-class="opacity-0 -translate-y-1"
              enter-to-class="opacity-100 translate-y-0"
              leave-active-class="transition-[transform,opacity] duration-150 ease-out motion-reduce:transition-none motion-reduce:duration-0"
              leave-from-class="opacity-100 translate-y-0"
              leave-to-class="opacity-0 -translate-y-1"
            >
              <div
                v-if="isReasoningOpen(msg)"
                class="text-muted mt-1.5 origin-top text-xs leading-relaxed whitespace-pre-wrap"
              >
                {{ msg.reasoning }}
              </div>
            </Transition>
          </div>
          <div
            class="prose prose-sm animate-result-in max-w-none"
            v-html="renderedBriefing"
          />
          <span
            v-if="lastMsg === msg && loading"
            class="bg-accent ml-0.5 inline-block h-4 w-1.5 animate-pulse align-text-bottom"
            aria-hidden="true"
          />
        </motion.div>

        <!-- Chat turns -->
        <motion.div
          v-else
          class="flex"
          :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
          :initial="{ opacity: 0, y: 10, scale: 0.97 }"
          :animate="{ opacity: 1, y: 0, scale: 1 }"
          :transition="{
            type: 'spring',
            stiffness: 320,
            damping: 28,
            delay: idx * 0.04,
          }"
        >
          <div
            class="max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
            :class="
              msg.role === 'user'
                ? 'bg-secondary text-ink whitespace-pre-line'
                : 'bg-surface/40 text-ink'
            "
          >
            <!-- 思考过程（仅助理消息 + reasoning 非空） -->
            <div
              v-if="msg.role === 'assistant' && msg.reasoning"
              class="border-ink/10 mb-2 border-b pb-2"
            >
              <button
                type="button"
                class="text-muted hover:text-ink focus-visible:ring-ring/40 inline-flex cursor-pointer items-center gap-1 text-xs transition-colors focus:outline-none focus-visible:ring-2"
                :aria-expanded="isReasoningOpen(msg)"
                @click="toggleReasoning(msg)"
              >
                <ChevronRight
                  class="h-3 w-3 shrink-0 transition-transform duration-200 motion-reduce:transition-none"
                  :class="isReasoningOpen(msg) && 'rotate-90'"
                  aria-hidden="true"
                />
                <span>思考过程</span>
              </button>
              <Transition
                enter-active-class="transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none motion-reduce:duration-0"
                enter-from-class="opacity-0 -translate-y-1"
                enter-to-class="opacity-100 translate-y-0"
                leave-active-class="transition-[transform,opacity] duration-150 ease-out motion-reduce:transition-none motion-reduce:duration-0"
                leave-from-class="opacity-100 translate-y-0"
                leave-to-class="opacity-0 -translate-y-1"
              >
                <div
                  v-if="isReasoningOpen(msg)"
                  class="text-muted mt-1.5 origin-top text-xs leading-relaxed whitespace-pre-wrap"
                >
                  {{ msg.reasoning }}
                </div>
              </Transition>
            </div>

            <div
              v-if="msg.role === 'assistant'"
              class="prose prose-sm max-w-none"
              v-html="rendered(msg)"
            />
            <span v-else>{{ msg.content }}</span>

            <!-- streaming cursor -->
            <span
              v-if="msg.role === 'assistant' && lastMsg === msg && loading"
              class="bg-card/70 ml-0.5 inline-block h-4 w-1.5 animate-pulse align-text-bottom"
              aria-hidden="true"
            />
          </div>
        </motion.div>
      </template>
    </div>

    <!-- Input bar -->
    <div class="px-4 py-3">
      <div
        class="bg-surface/30 focus-within:ring-ring/40 rounded-xl border transition-colors focus-within:ring-2"
      >
        <textarea
          v-model="input"
          :placeholder="hasContent ? '继续提问…' : '向 AI 提问这篇文章…'"
          class="text-ink placeholder-muted h-20 w-full resize-none rounded-t-xl bg-transparent px-3.5 py-3 text-sm focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="loading"
          @keydown="(e) => onKeydown(e, () => send(notifier.error))"
        />

        <!-- Toolbar: 模型切换 + 发送 -->
        <div class="flex items-center justify-between gap-2 px-2 pt-1 pb-2">
          <!-- 模型选择 -->
          <HoverDropdown
            panel-class="absolute left-0 bottom-full z-10 mb-1 w-56 rounded-lg border bg-card/95 p-1 shadow-lg backdrop-blur-md"
          >
            <template #trigger="{ isOpen }">
              <motion.button
                type="button"
                class="text-muted hover:bg-accent/10 hover:text-ink focus-visible:ring-ring/40 inline-flex max-w-[12rem] items-center gap-1.5 rounded-lg px-2 py-1.5 font-serif text-xs transition-colors focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                :aria-expanded="isOpen"
                :aria-label="`当前模型 ${modelLabel}，点击切换`"
                :disabled="loading"
                :whilePress="{ scale: 0.96 }"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 56 56"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M23.0837 4.14727C23.4047 3.94871 23.8119 3.94526 24.1139 4.17071L29.7956 6.88457C30.0573 7.08052 30.0169 7.47596 29.7311 7.63164C21.9807 11.8619 17.302 15.9874 14.8425 19.9949C13.2514 22.5852 10.3251 29.6555 12.9733 36.0359C15.716 42.6364 21.9322 45.0203 26.5329 45.0203C30.0087 45.0203 32.3712 43.9761 34.7712 42.3523C41.2785 37.9448 42.0285 29.3468 37.1852 23.4334V23.4305C37.2025 23.4453 39.8831 25.7483 41.5759 29.2352C41.2532 28.0697 40.7733 26.9511 40.1374 25.909C38.7028 23.5552 36.7695 21.5823 34.0407 20.2107C27.9675 17.1587 15.2951 18.6299 13.2995 31.7693C13.5017 22.6565 19.5393 16.9388 25.0056 15.1697C28.0421 14.1873 31.2569 13.9996 34.2907 14.5418C38.3385 11.2644 42.8127 9.79064 44.4147 9.33965C44.7842 9.23496 45.1834 9.33932 45.4557 9.61309C45.9141 10.0747 46.7149 10.8772 47.7341 11.8836H47.7399C48.0446 12.1842 47.8852 12.7025 47.4645 12.783C43.5274 13.5426 40.839 14.2947 37.9968 15.6072C41.4431 17.0031 44.3933 19.4488 46.1921 22.8201C46.4048 23.2172 46.2189 23.7081 45.7956 23.8611L43.3874 24.7332C45.5043 28.3329 46.0487 32.7462 45.0104 37.2664C43.2467 44.9513 37.3384 50.3896 29.7956 51.6834C28.6146 51.8848 27.444 52.0193 26.2927 51.9979C25.9026 51.9909 25.5967 51.6853 25.569 51.3162C25.4877 51.1735 25.4521 51.0025 25.4831 50.826L25.945 48.2361C23.8389 48.0884 21.8642 47.7391 19.8874 46.9393C8.15393 42.188 6.92433 30.5948 8.60711 23.5701C10.7915 14.4599 17.5068 7.55894 23.0837 4.14727Z"
                    fill="blue"
                  ></path>
                </svg>
                <span class="truncate">{{ modelLabel }}</span>
                <ChevronDown
                  class="text-muted h-3.5 w-3.5 shrink-0 transition-transform duration-200 motion-reduce:transition-none"
                  :class="isOpen && 'rotate-180'"
                  aria-hidden="true"
                />
              </motion.button>
            </template>

            <template #default="{ close }">
              <motion.div
                :initial="{ opacity: 0, scale: 0.96, y: 4 }"
                :animate="{ opacity: 1, scale: 1, y: 0 }"
                :exit="{ opacity: 0, scale: 0.96, y: 4 }"
                :transition="{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }"
              >
                <button
                  v-for="opt in modelOptions"
                  :key="opt.value"
                  type="button"
                  class="hover:bg-accent/10 flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left font-serif text-sm transition-colors"
                  :class="
                    opt.value === model ? 'bg-accent/10 text-ink' : 'text-muted'
                  "
                  :aria-pressed="opt.value === model"
                  @click="pickModel(opt.value, close)"
                >
                  <span class="truncate">{{ opt.label }}</span>
                  <Check
                    v-if="opt.value === model"
                    class="text-accent h-3.5 w-3.5 shrink-0"
                    aria-hidden="true"
                  />
                </button>
              </motion.div>
            </template>
          </HoverDropdown>
          <!-- 发送 / 停止 -->
          <motion.button
            type="button"
            class="focus-visible:ring-ring/40 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors focus:outline-none focus-visible:ring-2"
            :class="
              loading || canSend
                ? 'bg-accent text-contrast hover:bg-accent/90 cursor-pointer'
                : 'bg-ink/5 text-muted cursor-not-allowed'
            "
            :disabled="!loading && !canSend"
            :aria-label="loading ? '停止生成' : '发送'"
            :whilePress="{ scale: 0.9 }"
            @click="loading ? cancel() : send(notifier.error)"
          >
            <!-- 停止：方块 + 外圈旋转，点击中断流 -->
            <span
              v-if="loading"
              class="relative inline-flex h-4 w-4 items-center justify-center"
            >
              <Loader2
                class="absolute inset-0 h-4 w-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              <span
                class="bg-contrast h-1.5 w-1.5 rounded-[1px]"
                aria-hidden="true"
              />
            </span>
            <ArrowRight v-else class="h-4 w-4" aria-hidden="true" />
          </motion.button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* 辉光呼吸：空闲时缓慢、低幅 */
@keyframes glow-breathe {
  0%,
  100% {
    opacity: 0.25;
    transform: scale(0.95);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.05);
  }
}

/* 辉光脉冲：生成时更快、更高幅 */
@keyframes glow-pulse {
  0%,
  100% {
    opacity: 0.3;
    transform: scale(0.95);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.15);
  }
}

/* 总结内容入场：淡入 + 上滑 */
@keyframes result-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-glow-breathe {
  animation: glow-breathe 4s ease-in-out infinite;
}

.animate-glow-pulse {
  animation: glow-pulse 1.6s ease-in-out infinite;
}

.animate-result-in {
  animation: result-in 0.32s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@media (prefers-reduced-motion: reduce) {
  .animate-glow-breathe,
  .animate-glow-pulse,
  .animate-result-in {
    animation: none !important;
  }
}
</style>
