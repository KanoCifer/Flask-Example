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
import { FADE, SPRING_BOUNCE } from '@/constants';
import { renderMarkdown } from '@/composables';
import { HoverDropdown } from '@/components';
import { useNotificationStore } from '@/stores';
import { useAiCompanion, type AiMessage } from '@/features/ai/composables/useAiCompanion';

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
  isStreamingBriefing,
  bindContainer,
  generateBriefing,
  send,
  onKeydown,
  clearThread,
} = useAiCompanion({ title: props.title, content: props.content });

const briefing = computed(() =>
  messages.value.find((m) => m.kind === 'briefing'),
);
const renderedBriefing = computed(() =>
  briefing.value ? renderMarkdown(briefing.value.content) : '',
);
const lastMsg = computed(() => messages.value[messages.value.length - 1]);

const modelLabel = computed(
  () =>
    modelOptions.find((o) => o.value === model.value)?.label ?? model.value,
);

function pickModel(value: string, close?: () => void) {
  model.value = value;
  close?.();
}

const statusText = computed(() => {
  if (!loading.value) return '';
  return isStreamingBriefing.value ? '正在生成总结…' : '正在回复…';
});

function rendered(msg: AiMessage) {
  return renderMarkdown(msg.content);
}

</script>

<template>
  <section
    class="mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-card/70 via-card/50 to-accent/[0.04] shadow-sm shadow-accent/[0.06] ring-1 ring-accent/[0.08] backdrop-blur-md motion-reduce:backdrop-blur-none"
  >
    <!-- 辉光层：icon 背后的呼吸光晕，生成时脉冲加速 -->
    <div class="relative">
      <div
        class="pointer-events-none absolute top-0 left-6 h-16 w-16 rounded-full bg-accent/30 blur-2xl"
        :class="loading ? 'animate-glow-pulse' : 'animate-glow-breathe'"
        aria-hidden="true"
      />

      <!-- Header -->
      <div
        class="relative flex items-center justify-between gap-3 px-5 pt-4 pb-3"
      >
        <div class="flex items-center gap-2.5">
          <div
            class="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/10 shadow-sm shadow-accent/10"
            aria-hidden="true"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="text-accent"
            >
              <path d="M12 8V4H8" />
              <rect width="16" height="12" x="4" y="8" rx="2" />
              <path d="M2 14h2" />
              <path d="M20 14h2" />
              <path d="M15 13v2" />
              <path d="M9 13v2" />
            </svg>
          </div>
          <h3
            class="font-serif text-ink text-sm font-semibold tracking-tight"
          >
            AI 阅读伴侣
          </h3>
          <AnimatePresence mode="wait">
            <motion.span
              v-if="statusText"
              :key="statusText"
              :initial="{ opacity: 0, y: 6 }"
              :animate="{ opacity: 1, y: 0 }"
              :exit="{ opacity: 0, y: -6 }"
              :transition="FADE"
              class="text-muted text-xs"
            >
              {{ statusText }}
            </motion.span>
          </AnimatePresence>
        </div>

        <div class="flex items-center gap-1.5">
          <!-- 模型选择 -->
          <HoverDropdown
            panel-class="absolute right-0 top-full z-10 mt-1 w-56 rounded-lg border bg-card/95 p-1 shadow-lg backdrop-blur-md"
          >
            <template #trigger="{ isOpen }">
              <motion.button
                type="button"
                class="border bg-surface/30 text-ink inline-flex max-w-[12rem] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-surface/60 focus-visible:ring-2 focus-visible:ring-ring/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                :aria-expanded="isOpen"
                :aria-label="`当前模型 ${modelLabel}，点击切换`"
                :disabled="loading"
                :whilePress="{ scale: 0.96 }"
              >
                <span class="truncate">{{ modelLabel }}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="text-muted h-3.5 w-3.5 shrink-0 transition-transform duration-200 motion-reduce:transition-none"
                  :class="isOpen && 'rotate-180'"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="2"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M6 9l6 6 6-6"
                  />
                </svg>
              </motion.button>
            </template>

            <template #default="{ close }">
              <motion.div
                :initial="{ opacity: 0, scale: 0.96, y: -4 }"
                :animate="{ opacity: 1, scale: 1, y: 0 }"
                :exit="{ opacity: 0, scale: 0.96, y: -4 }"
                :transition="{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }"
              >
                <button
                  v-for="opt in modelOptions"
                  :key="opt.value"
                  type="button"
                  class="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-surface/60"
                  :class="
                    opt.value === model ? 'bg-surface/40 text-ink' : 'text-muted'
                  "
                  :aria-pressed="opt.value === model"
                  @click="pickModel(opt.value, close)"
                >
                  <span class="truncate">{{ opt.label }}</span>
                  <svg
                    v-if="opt.value === model"
                    xmlns="http://www.w3.org/2000/svg"
                    class="text-accent h-3.5 w-3.5 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </button>
              </motion.div>
            </template>
          </HoverDropdown>

          <!-- 清空 -->
          <motion.button
            v-if="hasContent"
            type="button"
            class="text-muted hover:text-ink dark:text-muted dark:hover:text-ink cursor-pointer rounded-lg px-2 py-1 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 focus:outline-none"
            aria-label="清空对话"
            :disabled="loading"
            :whilePress="{ scale: 0.96 }"
            @click="clearThread"
          >
            清空
          </motion.button>
        </div>
      </div>
    </div>

    <!-- Error -->
    <p v-if="error" class="text-destructive px-5 pb-3 text-sm">
      {{ error }}
    </p>

    <!-- Thread -->
    <div
      :ref="bindContainer"
      class="max-h-80 space-y-3 overflow-y-auto px-5 py-4"
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
          class="flex flex-col items-center gap-4 rounded-xl border border-dashed border-ink/10 bg-surface/20 px-6 py-8 text-center"
        >
          <div class="relative flex items-center justify-center">
            <div
              class="absolute h-16 w-16 rounded-full bg-accent/20 blur-2xl"
              :class="loading ? 'animate-glow-pulse' : 'animate-glow-breathe'"
              aria-hidden="true"
            />
            <div
              class="relative flex h-12 w-12 items-center justify-center rounded-xl border border-accent/20 bg-accent/10"
              aria-hidden="true"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="text-accent"
              >
                <path d="M12 8V4H8" />
                <rect width="16" height="12" x="4" y="8" rx="2" />
                <path d="M2 14h2" />
                <path d="M20 14h2" />
                <path d="M15 13v2" />
                <path d="M9 13v2" />
              </svg>
            </div>
          </div>
          <p class="text-ink text-sm leading-relaxed">
            点击「生成总结」，快速提炼文章核心要点
          </p>
          <button
            type="button"
            class="bg-accent text-contrast hover:bg-accent/90 disabled:bg-accent/40 inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 focus:outline-none disabled:cursor-not-allowed active:scale-[0.96]"
            :disabled="!canGenerate"
            @click="generateBriefing(notifier.error)"
          >
            <svg
              v-if="loading"
              class="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
              />
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            生成总结
          </button>
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
          class="rounded-xl border-t-2 border-accent/20 bg-surface/30 px-5 py-4"
        >
          <div class="mb-3 flex items-center gap-2">
            <span
              class="text-accent text-[11px] font-semibold tracking-[0.14em] uppercase"
              >摘要</span
            >
            <span class="text-muted text-xs">· {{ modelLabel }}</span>
            <button
              type="button"
              class="text-muted hover:text-ink ml-auto cursor-pointer text-xs transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 focus:outline-none"
              :disabled="loading"
              @click="generateBriefing(notifier.error)"
            >
              重新生成
            </button>
          </div>
          <div
            class="prose prose-sm max-w-none animate-result-in"
            v-html="renderedBriefing"
          />
          <span
            v-if="lastMsg === msg && loading"
            class="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-accent align-text-bottom"
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
            <div
              v-if="msg.role === 'assistant'"
              class="prose prose-sm max-w-none"
              v-html="rendered(msg)"
            />
            <span v-else>{{ msg.content }}</span>

            <!-- streaming cursor -->
            <span
              v-if="msg.role === 'assistant' && lastMsg === msg && loading"
              class="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-accent align-text-bottom"
              aria-hidden="true"
            />
          </div>
        </motion.div>
      </template>
    </div>

    <!-- Input bar -->
    <div
      class="flex items-center gap-2 border-t border-ink/10 px-4 py-3"
    >
      <input
        v-model="input"
        type="text"
        :placeholder="hasContent ? '继续提问…' : '向 AI 提问这篇文章…'"
        class="border bg-surface/30 text-ink placeholder-muted flex-1 rounded-lg px-3.5 py-2.5 text-sm transition-colors focus:ring-2 focus:ring-ring/40 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="loading"
        @keydown="(e) => onKeydown(e, () => send(notifier.error))"
      />
      <motion.button
        type="button"
        class="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 focus:outline-none"
        :class="
          canSend
            ? 'bg-accent text-contrast hover:bg-accent/90'
            : 'bg-ink/5 text-muted cursor-not-allowed'
        "
        :disabled="!canSend"
        aria-label="发送"
        :whilePress="{ scale: 0.9 }"
        @click="send(notifier.error)"
      >
        <svg
          v-if="loading"
          class="h-4 w-4 animate-spin motion-reduce:animate-none"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <svg
          v-else
          class="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M5 12h14M12 5l7 7-7 7"
          />
        </svg>
      </motion.button>
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
