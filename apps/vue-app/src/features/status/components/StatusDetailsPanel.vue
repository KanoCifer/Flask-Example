<script setup lang="ts">
import type { StatusDetailData } from '@/features/status/types';
import type { EventItem } from '@/features/status/api/logGateway';

type Tone = 'success' | 'warning' | 'destructive';

const TONE_TEXT: Record<Tone, string> = {
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
};
const TONE_DOT: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
};

const EVENT_TONE: Record<string, Tone> = {
  startup: 'success',
  deploy: 'success',
  notify_failure: 'destructive',
};
const EVENT_LABEL: Record<string, string> = {
  startup: '启动',
  deploy: '部署',
  notify_failure: '通知失败',
};

defineProps({
  serverStatus: {
    type: Object as () => StatusDetailData | null,
    required: true,
  },
  recentEvents: {
    type: Array as () => EventItem[],
    required: true,
  },
});

function pad2(n: number) {
  return n < 10 ? '0' + n : '' + n;
}

function bytesToMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function bytesToGB(bytes: number): string {
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatStartTime(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function formatLogTime(iso: string): string {
  const d = new Date(iso);
  return (
    `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
  );
}
</script>

<template>
  <div
    class="bg-card squircle mt-6 grid gap-8 border p-6 shadow-[inset_0_0_20px_0px_rgba(255,255,255,0.35)] sm:p-8 md:grid-cols-2"
  >
    <!-- 主机信息 -->
    <div class="space-y-4">
      <h3 class="text-ink font-serif text-[17px] tracking-[-0.01em]">
        主机信息
      </h3>
      <div v-if="serverStatus" class="text-[13px]">
        <dl class="divide-border divide-y">
          <div class="flex items-center justify-between py-2">
            <dt class="text-muted">操作系统 / 内核</dt>
            <dd class="text-ink text-right">
              {{ serverStatus.system.os_name }} ·
              {{ serverStatus.system.kernel_version }}
            </dd>
          </div>
          <div class="flex items-center justify-between gap-4 py-2">
            <dt class="text-muted shrink-0">CPU 型号</dt>
            <dd
              class="text-ink truncate text-right"
              :title="serverStatus.system.cpu_model"
            >
              {{ serverStatus.system.cpu_model }}
            </dd>
          </div>
          <div class="flex items-center justify-between py-2">
            <dt class="text-muted">核心(逻辑 / 物理)</dt>
            <dd class="text-ink tabular-nums">
              {{ serverStatus.system.cpu_count_logical }} /
              {{ serverStatus.system.cpu_count_physical }}
            </dd>
          </div>
          <div class="flex items-center justify-between py-2">
            <dt class="text-muted">总内存</dt>
            <dd class="text-ink tabular-nums">
              {{ bytesToGB(serverStatus.system.memory_total_bytes) }}
            </dd>
          </div>
          <div class="flex items-center justify-between py-2">
            <dt class="text-muted">已用</dt>
            <dd class="text-ink tabular-nums">
              {{ bytesToMB(serverStatus.system.memory_used_bytes) }}
            </dd>
          </div>
          <div class="flex items-center justify-between py-2">
            <dt class="text-muted">时区</dt>
            <dd class="text-ink">
              {{ serverStatus.system.system_timezone }}
            </dd>
          </div>
        </dl>
      </div>
      <div v-else class="space-y-2">
        <div class="bg-surface h-3 w-3/4 animate-pulse rounded" />
        <div class="bg-surface h-3 w-1/2 animate-pulse rounded" />
      </div>
    </div>

    <!-- 运行时 -->
    <div class="space-y-4">
      <h3 class="text-ink font-serif text-[17px] tracking-[-0.01em]">
        服务运行时
      </h3>
      <div v-if="serverStatus" class="text-[13px]">
        <dl class="divide-border divide-y">
          <div class="flex items-center justify-between py-2">
            <dt class="text-muted">运行时</dt>
            <dd class="text-ink">
              {{ serverStatus.service.runtime }}
            </dd>
          </div>
          <div class="flex items-center justify-between py-2">
            <dt class="text-muted">协程数</dt>
            <dd class="text-ink tabular-nums">
              {{ serverStatus.service.goroutines }}
            </dd>
          </div>
          <div class="flex items-center justify-between py-2">
            <dt class="text-muted">GC 次数</dt>
            <dd class="text-ink tabular-nums">
              {{ serverStatus.service.gc_count }}
            </dd>
          </div>
          <div class="flex items-center justify-between py-2">
            <dt class="text-muted">启动时间</dt>
            <dd class="text-ink tabular-nums">
              {{ formatStartTime(serverStatus.service.start_time) }}
            </dd>
          </div>
        </dl>
      </div>
      <div v-else class="space-y-2">
        <div class="bg-surface h-3 w-3/4 animate-pulse rounded" />
        <div class="bg-surface h-3 w-1/2 animate-pulse rounded" />
      </div>
    </div>

    <!-- 最近事件(跨双列) -->
    <div class="space-y-4 md:col-span-2">
      <h3 class="text-ink font-serif text-[17px] tracking-[-0.01em]">
        最近事件
      </h3>
      <div v-if="recentEvents.length" class="text-[13px]">
        <ol class="divide-border divide-y">
          <li
            v-for="event in recentEvents"
            :key="event.id"
            class="grid grid-cols-[auto_auto_1fr] items-baseline gap-3 py-2.5"
          >
            <span class="text-muted font-mono text-[12px] tabular-nums">
              {{ formatLogTime(event.timestamp) }}
            </span>
            <span
              :class="[
                'inline-flex items-center gap-1.5 text-[11px]',
                TONE_TEXT[EVENT_TONE[event.type] ?? 'success'],
              ]"
            >
              <span
                :class="[
                  'inline-block h-1.5 w-1.5 rounded-full',
                  TONE_DOT[EVENT_TONE[event.type] ?? 'success'],
                ]"
              />
              {{ EVENT_LABEL[event.type] ?? event.type }}
            </span>
            <span class="text-ink min-w-0 truncate">
              {{ event.title }}
            </span>
          </li>
        </ol>
      </div>
      <div v-else class="space-y-2">
        <div class="bg-surface h-3 w-3/4 animate-pulse rounded" />
        <div class="bg-surface h-3 w-1/2 animate-pulse rounded" />
      </div>
    </div>

    <!-- 版本(跨双列) -->
    <div
      v-if="serverStatus"
      class="text-muted flex items-center justify-between border-t pt-4 text-[12px] md:col-span-2"
    >
      <span>
        当前版本
        <code class="bg-surface text-ink ml-1.5 rounded px-1.5 py-0.5 font-mono"
          >v{{ serverStatus.version.current_version }}</code
        >
      </span>
      <a
        :href="serverStatus.version.repo_url"
        target="_blank"
        rel="noopener"
        class="hover:text-ink underline underline-offset-4 transition-colors"
        >查看仓库</a
      >
    </div>
  </div>
</template>
