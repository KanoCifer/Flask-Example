<template>
  <!--
    页内标题行 —— 不做 sticky bar。
    全站顶栏由 layout 的浮动 BasicNav 承担,这里若再画一条
    sticky + border-b + backdrop 的横条,会和 BasicNav 在同一视觉高度
    互相穿插。pt-24 给浮动 nav 留出净空。
  -->
  <header
    class="flex flex-wrap items-end justify-between gap-3 px-5 pt-10 pb-3 sm:px-10"
  >
    <div>
      <h1
        class="text-ink font-serif text-2xl leading-tight font-medium tracking-tight"
      >
        开发任务
      </h1>
      <p class="text-muted mt-0.5 font-serif text-sm italic">
        Agent-native Task Dashboard
      </p>
    </div>

    <div class="flex items-center gap-2">
      <template v-if="isAuthenticated">
        <UiButton
          variant="outline"
          class="refresh-btn relative gap-1.5 overflow-hidden p-2"
          :disabled="store.loading"
          title="刷新任务列表"
          @click="handleRefresh"
        >
          <span
            v-if="rippling"
            key="ripple"
            class="ripple-wave pointer-events-none absolute inset-0 m-auto block size-0 rounded-full bg-current/30"
          />
          <RotateCcw
            class="refresh-icon relative size-4"
            :class="
              rippling || store.loading
                ? 'animate-spin [animation-direction:reverse]'
                : ''
            "
          />
        </UiButton>
        <UiButton
          variant="outline"
          class="gap-1.5 px-3 py-2"
          title="签发 MCP 服务 Token"
          @click="emit('mcp-token')"
        >
          <KeyRound class="size-4" />
          MCP Token
        </UiButton>

        <UiButton class="gap-1.5 px-3.5 py-2" @click="emit('create')">
          <Plus class="size-4" />
          新建任务
        </UiButton>
      </template>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Button as UiButton } from '@/components';
import { useV3DevTaskStore } from '@/features/todos/stores/v3devtasks';
import { useAuthStore } from '@/features/auth';
import { KeyRound, Plus, RotateCcw } from '@lucide/vue';

const emit = defineEmits<{
  create: [];
  'mcp-token': [];
}>();

const authStore = useAuthStore();
const isAuthenticated = computed(() => authStore.isAuthenticated);

const store = useV3DevTaskStore();

// 点击触发的脉冲波纹 —— 每次点击重置 key 让 CSS 动画重新跑一遍
const rippling = ref(false);
let rippleTimer: ReturnType<typeof setTimeout> | null = null;

const handleRefresh = () => {
  // 先清掉上一次的定时器,避免快速连点时动画互相打断导致元素消失过早
  if (rippleTimer) clearTimeout(rippleTimer);
  rippling.value = false;
  // 用 requestAnimationFrame 等一帧再置 true,确保 v-if 重新挂载并重启动画
  requestAnimationFrame(() => {
    rippling.value = true;
    rippleTimer = setTimeout(() => {
      rippling.value = false;
    }, 1000);
  });
  store.fetchTasks();
};
</script>

<style scoped>
/*
 * 点击触发的脉冲波纹。
 * 使用 inset-0 + m-auto 居中,size-0 → size-[200%] 放大一倍覆盖整个按钮。
 * bg-current 继承按钮当前文字色,避免硬编码颜色(项目规则)。
 */
.ripple-wave {
  animation: ripple-expand 1000ms ease-out forwards;
}

.refresh-btn:active .refresh-icon {
  transform: scale(0.9);
}

.refresh-icon {
  transition: transform 150ms ease-out;
}

@keyframes ripple-expand {
  0% {
    width: 0;
    height: 0;
    opacity: 0.5;
  }
  100% {
    width: 200%;
    height: 200%;
    opacity: 0;
  }
}
</style>
