<template>
  <header
    class="bg-page/75 border-border sticky top-0 z-10 flex flex-wrap items-end justify-between gap-3 border-b px-5 py-3 backdrop-blur-sm sm:px-8"
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
          <RotateCcw class="size-4" />
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
