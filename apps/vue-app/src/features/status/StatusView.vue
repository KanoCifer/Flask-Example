<script setup lang="ts">
import { useServerStatus } from '@/features/status/composables/useServerStatus';
import { useLogStream } from '@/features/status/composables/useLogStream';
import StatusResourcesPanel from '@/features/status/components/StatusResourcesPanel.vue';
import StatusDetailsPanel from '@/features/status/components/StatusDetailsPanel.vue';
import { computed, ref } from 'vue';
import { motion, AnimatePresence } from 'motion-v';
import { EASE, EASE_SLOW } from '@/constants';

/* ── 类型 ── */
type Tone = 'success' | 'warning' | 'destructive';
type StatusKey = 'ok' | 'warn' | 'danger';

/* ── 语义 Tailwind 类静态映射(JIT 可扫描) ── */
const TONE_BG: Record<Tone, string> = {
  success: 'bg-success/8',
  warning: 'bg-warning/8',
  destructive: 'bg-destructive/8',
};
const TONE_TEXT: Record<Tone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
};
const TONE_BORDER: Record<Tone, string> = {
  success: 'border-success/20',
  warning: 'border-warning/25',
  destructive: 'border-destructive/25',
};
const STATUS_KEY_TO_TONE: Record<StatusKey, Tone> = {
  ok: 'success',
  warn: 'warning',
  danger: 'destructive',
};

/* ── Composables ── */
const {
  serverStatus,
  overallStatus,
  apiHealthy,
  apiLatency,
  wsLatency,
  wsStatus,
  dbStatus,
  latencyHistory,
  chartOption,
  now,
  availability,
  announcement,
} = useServerStatus();
const { recentEvents } = useLogStream();

/* ── Reduced motion ── */
const prefersReducedMotion = computed(() => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
});

/* ── Time formatters ── */
function pad2(n: number) {
  return n < 10 ? '0' + n : '' + n;
}
function fmtClock(ts: number) {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
function fmtDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString('zh-CN', { month: 'short', day: '2-digit' });
}
function formatUptime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d === 0 && h === 0 && m === 0) {
    return `${d}d ${pad2(h)}h ${pad2(m)}m ${pad2(s % 60)}s`;
  }
  return `${d}d ${pad2(h)}h ${pad2(m)}m`;
}

/* ── 详情折叠 ── */
const showDetails = ref(false);
</script>

<template>
  <div class="bg-page min-h-screen">
    <motion.div
      :initial="prefersReducedMotion ? false : { opacity: 0, y: 8 }"
      :animate="{ opacity: 1, y: 0 }"
      :transition="EASE_SLOW"
      class="mx-auto w-full max-w-6xl space-y-10 px-4 py-12 sm:px-6"
    >
      <!-- ─── Hero: 状态宣告 ─── -->
      <section :aria-label="overallStatus.title">
        <AnimatePresence mode="wait">
          <motion.div
            :key="overallStatus.key"
            :initial="prefersReducedMotion ? false : { opacity: 0, y: 6 }"
            :animate="{ opacity: 1, y: 0 }"
            :exit="
              prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -6 }
            "
            :transition="EASE"
            :class="[
              'relative overflow-hidden rounded-2xl border p-6 sm:p-10',
              TONE_BORDER[overallStatus.tone],
              TONE_BG[overallStatus.tone],
            ]"
          >
            <div class="grid gap-6 md:grid-cols-[1.5fr_1fr] md:items-end">
              <!-- 状态词 -->
              <div class="space-y-3">
                <h1
                  class="text-ink font-serif text-[clamp(2.25rem,5vw+1rem,4.5rem)] leading-[1.05] tracking-[-0.025em]"
                  style="text-wrap: balance"
                >
                  {{ overallStatus.title }}
                </h1>
                <p class="text-muted max-w-[48ch] text-[15px] leading-relaxed">
                  {{ overallStatus.sub
                  }}<span v-if="serverStatus">
                    · 启动于
                    <span class="text-ink/80">{{
                      formatUptime(now - serverStatus.service.start_time * 1000)
                    }}</span
                    >前</span
                  >
                </p>

                <!-- mini 三联 -->
                <div
                  class="border-ink/10 mt-5 grid grid-cols-3 gap-x-6 gap-y-1 border-t pt-4 text-[13px]"
                >
                  <div class="space-y-0.5">
                    <div class="text-muted">API</div>
                    <div class="flex items-baseline gap-1.5">
                      <span
                        class="text-ink font-mono text-[15px] font-semibold tabular-nums"
                      >
                        <AnimatePresence mode="popLayout">
                          <motion.span
                            :key="apiHealthy ? apiLatency : -1"
                            :initial="
                              prefersReducedMotion
                                ? false
                                : { opacity: 0, y: 4 }
                            "
                            :animate="{ opacity: 1, y: 0 }"
                            :exit="
                              prefersReducedMotion
                                ? { opacity: 1 }
                                : { opacity: 0, y: -4 }
                            "
                            :transition="{ duration: 0.2 }"
                          >
                            {{ apiHealthy ? apiLatency : '—' }}
                          </motion.span>
                        </AnimatePresence>
                      </span>
                      <span class="text-muted text-[11px]">ms</span>
                    </div>
                  </div>
                  <div class="space-y-0.5">
                    <div class="text-muted">WebSocket</div>
                    <div class="flex items-baseline gap-1.5">
                      <span
                        :class="[
                          'font-mono text-[15px] font-semibold tabular-nums',
                          TONE_TEXT[STATUS_KEY_TO_TONE[wsStatus.key]],
                        ]"
                      >
                        <AnimatePresence mode="popLayout">
                          <motion.span
                            :key="wsLatency"
                            :initial="
                              prefersReducedMotion
                                ? false
                                : { opacity: 0, y: 4 }
                            "
                            :animate="{ opacity: 1, y: 0 }"
                            :exit="
                              prefersReducedMotion
                                ? { opacity: 1 }
                                : { opacity: 0, y: -4 }
                            "
                            :transition="{ duration: 0.2 }"
                          >
                            {{ wsLatency }}
                          </motion.span>
                        </AnimatePresence>
                      </span>
                      <span class="text-muted text-[11px]">ms</span>
                    </div>
                  </div>
                  <div class="space-y-0.5">
                    <div class="text-muted">Database</div>
                    <div
                      :class="[
                        'text-[15px] font-semibold',
                        TONE_TEXT[STATUS_KEY_TO_TONE[dbStatus.key]],
                      ]"
                    >
                      {{ dbStatus.label }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- 右侧:时钟 -->
              <div class="space-y-1 text-right">
                <div class="text-muted text-[12px]">当前时刻</div>
                <div
                  class="text-ink font-mono text-[clamp(1.75rem,2.5vw+0.5rem,2.5rem)] leading-none tracking-[-0.02em] tabular-nums"
                >
                  {{ fmtClock(now) }}
                </div>
                <div class="text-muted text-[12px]">
                  {{ fmtDate(now) }} · 最后检测 {{ fmtClock(now) }}
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </section>

      <!-- ─── 公告 + 30 天可用率 ─── -->
      <section class="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-baseline">
        <p class="text-ink/85 text-[14px] leading-relaxed">
          <template v-if="announcement">
            <span
              class="bg-warning/15 text-warning mr-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
              >公告</span
            >
            {{ announcement }}
          </template>
          <template v-else>
            <span class="text-muted">暂无公告 ·</span>
            一切运行平稳,变更会同步发布在此。
          </template>
        </p>
        <p class="text-muted text-[13px] tabular-nums">
          过去 30 天 ·
          <span v-if="availability" class="text-ink font-mono font-semibold"
            >{{ availability.rate.toFixed(2) }}%</span
          >
          <span v-else class="text-ink/60">—</span>
          可用
          <template v-if="availability && availability.incidents > 0">
            · {{ availability.incidents }} 次中断
          </template>
          <template v-else-if="availability"> · 无中断 </template>
          <template v-else> · 历史数据收集中 </template>
        </p>
      </section>

      <!-- ─── 资源 + 延迟(双列) ─── -->
      <StatusResourcesPanel
        :server-status="serverStatus"
        :chart-option="chartOption"
        :latency-history="latencyHistory"
      />

      <!-- ─── 详情面板(折叠) ─── -->
      <section>
        <button
          type="button"
          class="text-muted hover:text-ink group inline-flex items-center gap-2 text-[13px] transition-colors"
          :aria-expanded="showDetails"
          aria-controls="status-details-panel"
          @click="showDetails = !showDetails"
        >
          <span
            class="bg-border inline-block h-px w-6 transition-all duration-300 group-hover:w-8"
          />
          {{ showDetails ? '收起详细信息' : '展开详细信息' }}
          <svg
            :class="[
              'h-3 w-3 transition-transform duration-300',
              showDetails ? 'rotate-180' : '',
            ]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        <AnimatePresence>
          <motion.div
            v-if="showDetails"
            id="status-details-panel"
            :initial="prefersReducedMotion ? false : { opacity: 0, height: 0 }"
            :animate="{ opacity: 1, height: 'auto' }"
            :exit="
              prefersReducedMotion ? { opacity: 0 } : { opacity: 0, height: 0 }
            "
            :transition="EASE"
            class="overflow-hidden"
          >
            <StatusDetailsPanel
              :server-status="serverStatus"
              :recent-events="recentEvents"
            />
          </motion.div>
        </AnimatePresence>
      </section>
    </motion.div>
  </div>
</template>
