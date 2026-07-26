<template>
  <UiModal :open="open" size="md" @close="emit('close')">
    <div class="flex flex-col">
      <!-- ── 头部 ── -->
      <header
        class="flex items-start justify-between gap-3 border-b px-6 pt-5 pb-4"
      >
        <div>
          <h2 class="text-ink text-lg font-semibold">签发 MCP 服务 Token</h2>
          <p class="text-muted mt-0.5 text-xs">
            生成长期有效的 service-JWT，供 MCP server 调用 devtask 接口。
          </p>
        </div>
        <button
          class="text-muted hover:bg-surface hover:text-ink cursor-pointer rounded-md p-1.5 transition-colors"
          aria-label="关闭"
          @click="emit('close')"
        >
          <svg
            class="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </header>

      <!-- ── 内容 ── -->
      <div class="px-6 py-5">
        <!-- 时长选择 -->
        <div class="mb-5">
          <span class="text-muted mb-2 block text-xs font-medium">有效期</span>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="opt in DAY_OPTIONS"
              :key="opt.days"
              type="button"
              class="cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
              :class="
                days === opt.days
                  ? 'border-accent/40 bg-accent/10 text-ink'
                  : 'text-muted hover:text-ink'
              "
              @click="days = opt.days"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- 生成按钮 -->
        <button
          type="button"
          class="bg-accent text-ink hover:bg-accent/90 focus-visible:ring-ring inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loading"
          @click="handleGenerate"
        >
          <svg
            v-if="loading"
            class="h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke-width="4"
            />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <template v-else>生成 Token</template>
        </button>

        <!-- 错误 -->
        <p
          v-if="error"
          class="text-destructive mt-3 rounded-lg border px-3 py-2 text-xs"
          style="
            border-color: color-mix(
              in oklch,
              var(--destructive) 40%,
              transparent
            );
          "
        >
          {{ error }}
        </p>

        <!-- 结果 -->
        <div v-if="result" class="mt-5 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-muted block text-xs font-medium">Token</span>
            <span class="text-muted text-[11px]">
              有效期至 {{ formatDate(result.expires_at) }}（{{ result.days }}
              天）
            </span>
          </div>

          <div class="relative">
            <textarea
              class="bg-surface text-ink block w-full resize-none rounded-lg border px-3 py-2 pr-10 font-mono text-[11px] leading-relaxed outline-none"
              rows="4"
              readonly
              :value="result.token"
            />
            <button
              type="button"
              class="text-muted hover:bg-surface hover:text-ink absolute top-2 right-2 cursor-pointer rounded-md p-1.5 transition-colors"
              :title="copied ? '已复制' : '复制'"
              @click="handleCopy"
            >
              <svg
                v-if="copied"
                class="text-success h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <svg
                v-else
                class="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <rect
                  x="9"
                  y="9"
                  width="13"
                  height="13"
                  rx="2"
                  ry="2"
                  stroke-width="2"
                />
                <path
                  d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </div>

          <!-- 安全提示 -->
          <p class="text-muted text-[11px] leading-relaxed">
            Token 拥有完整的 devtask
            读写权限。生成后请妥善保管，泄露后请尽快在服务端轮换
            <code class="bg-surface px-1 py-0.5 font-mono text-[10px]"
              >DEV_TASK_SECRET</code
            >
            。
          </p>
        </div>
      </div>
    </div>
  </UiModal>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Modal as UiModal } from '@/components';
import { devTaskGateway, type McpTokenResult } from '@/features/todos/api';

interface DayOption {
  days: number;
  label: string;
}

const DAY_OPTIONS: DayOption[] = [
  { days: 7, label: '7 天' },
  { days: 30, label: '30 天' },
  { days: 90, label: '90 天' },
  { days: 365, label: '1 年' },
];

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const days = ref<number>(90);
const loading = ref(false);
const error = ref('');
const result = ref<McpTokenResult | null>(null);
const copied = ref(false);

async function handleGenerate() {
  loading.value = true;
  error.value = '';
  result.value = null;
  copied.value = false;
  try {
    result.value = await devTaskGateway.issueMcpToken(days.value);
  } catch (e) {
    error.value = e instanceof Error ? e.message : '生成失败';
  } finally {
    loading.value = false;
  }
}

async function handleCopy() {
  if (!result.value) return;
  try {
    await navigator.clipboard.writeText(result.value.token);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    error.value = '复制失败，请手动选中复制';
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}
</script>
