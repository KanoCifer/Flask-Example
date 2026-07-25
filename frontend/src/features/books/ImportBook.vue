<template>
  <div class="bg-page flex min-h-screen items-center justify-center px-4 py-16">
    <div class="w-full max-w-xl" style="animation: fadeInUp 0.6s ease-out">
      <!-- Header -->
      <div class="mb-10">
        <h1
          class="text-ink text-[clamp(2rem,5vw,3rem)] leading-tight font-bold tracking-tight"
        >
          绑定微信读书<br />API Key
        </h1>
        <p class="text-muted mt-4 text-base leading-relaxed">
          在下方输入您的微信读书
          <code
            class="bg-surface text-ink rounded px-1.5 py-0.5 font-mono text-xs"
            >wrk-</code
          >
          开头的 API Key，服务端会保存它用于后续书架同步
        </p>
      </div>

      <!-- Success Banner -->
      <div
        v-if="saved"
        class="border-success/40 bg-success/10 text-success mb-8 flex items-start gap-3 rounded-2xl border p-4"
        role="status"
      >
        <svg
          class="mt-0.5 h-5 w-5 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div>
          <p class="font-medium">API Key 已成功保存</p>
          <p class="text-success/80 mt-1 text-xs">
            后续的书架同步将基于此 Key 在后台拉取您的微信读书数据。
          </p>
        </div>
      </div>

      <!-- Form -->
      <form @submit.prevent="handleSubmit" class="space-y-6" novalidate>
        <!-- API Key Input -->
        <div class="space-y-2">
          <label
            for="weread_api_key"
            class="text-ink block text-base font-medium"
          >
            WeRead API Key
          </label>
          <div class="relative">
            <input
              id="weread_api_key"
              v-model="apiKey"
              :type="showKey ? 'text' : 'password'"
              autocomplete="off"
              spellcheck="false"
              :aria-invalid="hasFieldError"
              :aria-describedby="
                hasFieldError ? 'api-key-error' : 'api-key-hint'
              "
              class="border-input bg-page text-ink placeholder:text-muted/70 focus:ring-accent/20 w-full rounded-2xl border px-5 py-4 pr-14 font-mono text-base transition-all duration-200 focus:ring-2 focus:outline-none"
              :class="
                hasFieldError
                  ? 'border-destructive focus:border-destructive focus:ring-destructive/20'
                  : 'focus:border-accent'
              "
              placeholder="wrk-xxxxxxxxxxxxxxxx"
            />
            <button
              type="button"
              class="text-muted hover:text-ink focus:ring-ring absolute inset-y-0 right-2 my-auto flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus:ring-2 focus:outline-none"
              :aria-label="showKey ? '隐藏 API Key' : '显示 API Key'"
              :aria-pressed="showKey"
              @click="toggleKeyVisibility"
            >
              <svg
                v-if="showKey"
                class="h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                />
              </svg>
              <svg
                v-else
                class="h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>
          <FieldError
            :message="fieldError"
            hint="API Key 仅保存在您的服务端账户中，不会在浏览器本地留存。"
            size="xs"
            hide-icon
            id="api-key"
          />
          <a
            href="https://weread.qq.com/r/weread-skills"
            target="_blank"
            rel="noopener noreferrer"
            class="text-ink hover:text-ink/80 mt-2 inline-flex items-center gap-1 text-xs font-medium transition-colors"
          >
            还没有 API Key？
            <span class="underline underline-offset-2"
              >前往 WeRead Skills 获取</span
            >
            <svg
              class="h-3 w-3"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
              />
            </svg>
          </a>
        </div>

        <!-- Submit Button -->
        <Button size="lg" class="w-full" type="submit" :disabled="loading">
          <span v-if="loading" class="flex items-center justify-center gap-2">
            <span
              class="border-accent/30 border-t-accent h-4 w-4 animate-spin rounded-full border-2"
            ></span>
            保存中...
          </span>
          <span v-else class="flex items-center justify-center gap-2">
            <svg
              class="h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
            保存 API Key
          </span>
        </Button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { wereadGateway } from '@/features/books/api';
import { Button, FieldError } from '@/components';
import { useNotificationStore } from '@/stores';
import { computed, ref } from 'vue';

const WEREAD_API_KEY_PATTERN = /^wrk-[A-Za-z0-9_-]+$/;

const apiKey = ref('');
const showKey = ref(false);
const loading = ref(false);
const saved = ref(false);
const fieldError = ref('');

const notifier = useNotificationStore();

const hasFieldError = computed(() => fieldError.value.length > 0);

const toggleKeyVisibility = () => {
  showKey.value = !showKey.value;
};

const validateApiKey = (key: string): string => {
  const trimmed = key.trim();
  if (!trimmed) return '请输入微信读书 API Key';
  if (!WEREAD_API_KEY_PATTERN.test(trimmed)) {
    return 'API Key 必须以 wrk- 开头，例如 wrk-AbCdEf123456';
  }
  return '';
};

const handleSubmit = async () => {
  fieldError.value = validateApiKey(apiKey.value);
  if (fieldError.value) return;

  loading.value = true;
  saved.value = false;
  try {
    const response = await wereadGateway.saveUserInfo(apiKey.value.trim());
    saved.value = true;
    apiKey.value = '';
    notifier.success(response.message || 'API Key 已保存');
  } catch (err: unknown) {
    const error = err as { message?: string };
    notifier.error(error?.message || '保存失败，请稍后重试');
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
