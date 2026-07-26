<script setup lang="ts">
import { reactive, watch } from 'vue';
import type { ReminderFormState } from '../types';
import { ModalFadeTransition } from '@/components';
import { channelOptions, reminderPointOptions } from '../subscriptionUtils';

interface Props {
  isOpen: boolean;
  form: ReminderFormState;
  isTesting: boolean;
  isSaving: boolean;
  errorMessage: string;
  testResult: Record<string, boolean> | null;
}

const emit = defineEmits<{
  close: [];
  test: [form: ReminderFormState];
  save: [form: ReminderFormState];
}>();

const props = defineProps<Props>();

const localForm = reactive<ReminderFormState>({
  channels: [],
  days_30: false,
  days_7: true,
  days_3: false,
  days_1: true,
  day_of: true,
  email: '',
  feishu_webhook_url: '',
  bark_device_key: '',
});

function syncLocalForm(source: ReminderFormState): void {
  localForm.channels = [...source.channels];
  localForm.days_30 = source.days_30;
  localForm.days_7 = source.days_7;
  localForm.days_3 = source.days_3;
  localForm.days_1 = source.days_1;
  localForm.day_of = source.day_of;
  localForm.email = source.email;
  localForm.feishu_webhook_url = source.feishu_webhook_url;
  localForm.bark_device_key = source.bark_device_key;
}

function emitSave(): void {
  emit('save', {
    channels: [...localForm.channels],
    days_30: localForm.days_30,
    days_7: localForm.days_7,
    days_3: localForm.days_3,
    days_1: localForm.days_1,
    day_of: localForm.day_of,
    email: localForm.email,
    feishu_webhook_url: localForm.feishu_webhook_url,
    bark_device_key: localForm.bark_device_key,
  });
}

function emitTest(): void {
  emit('test', {
    channels: [...localForm.channels],
    days_30: localForm.days_30,
    days_7: localForm.days_7,
    days_3: localForm.days_3,
    days_1: localForm.days_1,
    day_of: localForm.day_of,
    email: localForm.email,
    feishu_webhook_url: localForm.feishu_webhook_url,
    bark_device_key: localForm.bark_device_key,
  });
}

function toggleChannel(channel: string): void {
  const hasChannel = localForm.channels.includes(channel);
  localForm.channels = hasChannel
    ? localForm.channels.filter((item) => item !== channel)
    : [...localForm.channels, channel];
}

watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      syncLocalForm(props.form);
    }
  },
  { immediate: true },
);
</script>

<template>
  <teleport to="body">
    <ModalFadeTransition>
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      >
        <button
          type="button"
          aria-label="关闭弹窗"
          class="bg-page/60 absolute inset-0 backdrop-blur-sm"
          @click="emit('close')"
        />
        <section
          class="bg-page relative z-10 w-full max-w-2xl rounded-2xl border p-5 shadow-2xl"
        >
          <header class="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 class="text-ink text-lg font-semibold">通知渠道配置</h3>
              <p class="text-muted mt-1 text-sm">
                选择通知渠道和提醒触发时间点，可先发送测试通知。
              </p>
            </div>
            <button
              type="button"
              class="text-muted hover:bg-surface rounded-lg border px-3 py-1 text-xs transition"
              @click="emit('close')"
            >
              关闭
            </button>
          </header>

          <div class="space-y-4">
            <section>
              <p
                class="text-muted mb-2 text-xs font-semibold tracking-wide uppercase"
              >
                通知渠道
              </p>
              <div class="grid gap-2 sm:grid-cols-3">
                <button
                  v-for="channel in channelOptions"
                  :key="channel.value"
                  type="button"
                  class="rounded-xl border px-3 py-2 text-sm transition"
                  :class="
                    localForm.channels.includes(channel.value)
                      ? 'border-accent/30 bg-accent/15 text-ink'
                      : 'bg-page text-ink hover:bg-surface'
                  "
                  @click="toggleChannel(channel.value)"
                >
                  {{ channel.label }}
                </button>
              </div>
            </section>

            <section>
              <p
                class="text-muted mb-2 text-xs font-semibold tracking-wide uppercase"
              >
                提醒时间点
              </p>
              <div class="grid gap-2 sm:grid-cols-3">
                <label
                  v-for="point in reminderPointOptions"
                  :key="point.key"
                  class="bg-page text-ink flex items-center gap-2 rounded-xl border px-3 py-2 text-sm"
                >
                  <input
                    v-model="localForm[point.key]"
                    type="checkbox"
                    class="text-ink focus:ring-accent/30 h-4 w-4 rounded"
                  />
                  {{ point.label }}
                </label>
              </div>
            </section>

            <section class="grid gap-3">
              <label
                v-if="localForm.channels.includes('email')"
                class="space-y-1"
              >
                <span class="text-muted text-xs font-medium"
                  >邮箱地址（Email）</span
                >
                <input
                  v-model="localForm.email"
                  type="email"
                  placeholder="name@example.com"
                  class="bg-page text-ink focus:border-accent focus:ring-accent/20 placeholder:text-muted w-full rounded-xl border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
                />
              </label>
              <label
                v-if="localForm.channels.includes('feishu')"
                class="space-y-1"
              >
                <span class="text-muted text-xs font-medium"
                  >飞书 Webhook URL</span
                >
                <input
                  v-model="localForm.feishu_webhook_url"
                  type="text"
                  placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
                  class="bg-page text-ink focus:border-accent focus:ring-accent/20 placeholder:text-muted w-full rounded-xl border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
                />
              </label>
              <label
                v-if="localForm.channels.includes('bark')"
                class="space-y-1"
              >
                <span class="text-muted text-xs font-medium"
                  >Bark Device Key</span
                >
                <input
                  v-model="localForm.bark_device_key"
                  type="text"
                  placeholder="请输入 Bark 设备 Key"
                  class="bg-page text-ink focus:border-accent focus:ring-accent/20 placeholder:text-muted w-full rounded-xl border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
                />
              </label>
            </section>

            <div
              v-if="testResult"
              class="bg-surface/50 text-ink rounded-xl border px-3 py-2 text-xs"
            >
              <p class="mb-2 font-medium">测试结果</p>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="(success, channel) in testResult"
                  :key="channel"
                  class="rounded-full px-2.5 py-1"
                  :class="
                    success
                      ? 'bg-success/20 text-success'
                      : 'bg-destructive/20 text-destructive'
                  "
                >
                  {{ channel }}: {{ success ? '成功' : '失败' }}
                </span>
              </div>
            </div>

            <p
              v-if="errorMessage"
              class="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm"
            >
              {{ errorMessage }}
            </p>

            <footer class="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                class="text-muted hover:bg-surface rounded-xl border px-3 py-2 text-sm transition"
                @click="emit('close')"
              >
                取消
              </button>
              <button
                type="button"
                :disabled="isTesting"
                class="border-accent/30 bg-accent/15 text-ink hover:bg-surface rounded-xl border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60"
                @click="emitTest"
              >
                {{ isTesting ? '测试中...' : '发送测试通知' }}
              </button>
              <button
                type="button"
                :disabled="isSaving"
                class="bg-accent text-ink hover:bg-accent/90 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                @click="emitSave"
              >
                {{ isSaving ? '保存中...' : '保存配置' }}
              </button>
            </footer>
          </div>
        </section>
      </div>
    </ModalFadeTransition>
  </teleport>
</template>
