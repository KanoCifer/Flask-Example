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
          class="gap-1.5 p-2"
          :disabled="store.loading"
          title="刷新任务列表"
          @click="store.fetchTasks()"
        >
          <RotateCcw class="size-4" :class="{ 'animate-spin': store.loading }" />
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
import { computed } from 'vue';
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
</script>
