<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <ModalFadeTransition>
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        @click="handleClose"
      />
    </ModalFadeTransition>

    <!-- Modal -->
    <ModalScaleTransition>
      <div
        v-if="modelValue"
        class="fixed inset-x-4 inset-y-24 z-50 flex items-center justify-center sm:inset-x-auto sm:inset-y-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2"
      >
        <div
          class="bg-page max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl shadow-2xl dark:shadow-xl dark:shadow-slate-900/60"
        >
          <!-- Header -->
          <div class="bg-page sticky top-0 z-10 border-b px-6 pt-6 pb-4">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3">
                <div
                  class="bg-accent shadow-accent/30 flex h-10 w-10 items-center justify-center rounded-xl shadow-lg"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                    class="text-ink h-5 w-5"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                    />
                  </svg>
                </div>
                <div>
                  <h2 class="text-ink font-serif text-2xl font-bold">
                    里程碑提醒
                  </h2>
                  <p class="text-muted mt-0.5 text-xs">
                    {{ device.name }}
                  </p>
                </div>
              </div>
              <span
                class="bg-warning/20 text-warning shrink-0 rounded-full px-3 py-1 text-xs font-semibold"
              >
                提醒配置
              </span>
            </div>
          </div>

          <form @submit.prevent="handleSubmit" class="bg-page space-y-6 p-6">
            <!-- Enable Toggle -->
            <div
              class="bg-page flex items-center justify-between rounded-2xl border px-5 py-4 shadow-sm"
            >
              <div class="flex items-center gap-3">
                <div
                  v-if="form.enabled"
                  class="bg-accent flex h-9 w-9 items-center justify-center rounded-xl shadow-md"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                    class="text-ink h-4 w-4"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                    />
                  </svg>
                </div>
                <div
                  v-else
                  class="bg-surface flex h-9 w-9 items-center justify-center rounded-xl"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                    class="text-muted h-4 w-4"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M5.636 5.636a9 9 0 1012.728 0M12 3v9"
                    />
                  </svg>
                </div>
                <div>
                  <p class="text-ink text-sm font-semibold">启用里程碑提醒</p>
                  <p class="text-muted text-xs">
                    在设备到达里程碑天数时发送通知
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                :aria-checked="form.enabled"
                @click="form.enabled = !form.enabled"
                :class="[
                  'relative flex h-6 w-11 shrink-0 rounded-full transition-colors duration-300',
                  form.enabled ? 'bg-accent' : 'bg-surface/30',
                ]"
              >
                <span
                  :class="[
                    'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300',
                    form.enabled ? 'translate-x-5.5' : 'translate-x-0.5',
                  ]"
                />
              </button>
            </div>

            <!-- Milestones -->
            <div class="space-y-3">
              <div class="flex items-center gap-2">
                <div
                  class="via-border h-px flex-1 bg-linear-to-r from-transparent to-transparent"
                />
                <span
                  class="text-muted shrink-0 text-xs font-semibold tracking-widest uppercase"
                  >里程碑节点</span
                >
                <div
                  class="via-border h-px flex-1 bg-linear-to-r from-transparent to-transparent"
                />
              </div>

              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="preset in milestonePresets"
                  :key="preset.days"
                  type="button"
                  @click="toggleMilestone(preset.days)"
                  :class="[
                    'relative flex flex-col items-center gap-1 rounded-xl px-3 py-3 text-xs font-semibold transition-all duration-200',
                    form.milestones.includes(preset.days)
                      ? 'bg-accent text-ink shadow-accent/25 shadow-lg'
                      : 'bg-page text-muted hover:bg-surface border shadow-sm',
                  ]"
                >
                  <span class="text-base">{{
                    formatMilestone(preset.days)
                  }}</span>
                  <span
                    :class="[
                      'text-[10px] font-medium',
                      form.milestones.includes(preset.days)
                        ? 'text-ink/70'
                        : 'text-muted/60',
                    ]"
                    >Day {{ preset.days }}</span
                  >
                  <span
                    v-if="form.milestones.includes(preset.days)"
                    class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="3"
                      stroke="currentColor"
                      class="text-ink h-2 w-2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                      />
                    </svg>
                  </span>
                </button>
              </div>

              <!-- Custom milestone -->
              <div class="flex gap-2">
                <div class="relative flex-1">
                  <input
                    v-model.number="customMilestone"
                    type="number"
                    min="1"
                    placeholder="自定义天数..."
                    class="text-ink placeholder:text-muted focus:border-accent focus:ring-accent/30 bg-page w-full rounded-xl border py-2.5 pr-12 pl-4 text-sm font-medium ring-2 ring-transparent transition-all outline-none"
                  />
                  <span
                    class="text-muted pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs"
                    >天</span
                  >
                </div>
                <button
                  type="button"
                  @click="addCustomMilestone"
                  class="bg-page text-muted hover:border-accent/30 hover:bg-accent/10 hover:text-ink flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-all active:scale-95"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                    class="h-[18px] w-[18px]"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M12 4.5v15m7.5-7.5h-15"
                    />
                  </svg>
                </button>
              </div>

              <!-- Selected milestones tags -->
              <div
                v-if="form.milestones.length > 0"
                class="border-accent/30 bg-accent/10 flex min-w-0 flex-wrap gap-1.5 rounded-xl border border-dashed p-3"
              >
                <span
                  v-for="d in form.milestones"
                  :key="d"
                  class="bg-accent/15 text-ink inline-flex items-center gap-1 rounded-full py-0.5 pr-1.5 pl-2.5 text-xs font-semibold"
                >
                  {{ formatMilestone(d) }}
                  <button
                    type="button"
                    @click="toggleMilestone(d)"
                    class="hover:bg-accent/20 flex h-4 w-4 items-center justify-center rounded-full"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="3"
                      stroke="currentColor"
                      class="h-2 w-2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </span>
              </div>
            </div>

            <!-- Channels -->
            <div class="space-y-3">
              <div class="flex items-center gap-2">
                <div
                  class="via-border h-px flex-1 bg-linear-to-r from-transparent to-transparent"
                />
                <span
                  class="text-muted shrink-0 text-xs font-semibold tracking-widest uppercase"
                  >通知渠道</span
                >
                <button
                  type="button"
                  :disabled="testLoading"
                  @click="handleTestNotification"
                  class="border-accent/20 bg-accent/10 text-ink hover:bg-accent/20 ml-auto flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg
                    v-if="testLoading"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                    class="h-3 w-3 animate-spin"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  <svg
                    v-else
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                    class="h-3 w-3"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z"
                    />
                  </svg>
                  测试通知
                </button>
                <div
                  class="via-border h-px flex-1 bg-linear-to-r from-transparent to-transparent"
                />
              </div>

              <div class="flex gap-2">
                <button
                  v-for="opt in channelOptions"
                  :key="opt.value"
                  type="button"
                  @click="toggleChannel(opt.value)"
                  :class="[
                    'flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-semibold transition-all duration-200',
                    form.channels.includes(opt.value)
                      ? 'bg-accent text-ink shadow-accent/25 shadow-lg'
                      : 'bg-page text-muted hover:bg-surface border shadow-sm',
                  ]"
                >
                  <span v-html="opt.icon" />
                  {{ opt.label }}
                </button>
              </div>

              <!-- Channel-specific fields -->
              <label
                v-if="form.channels.includes('email')"
                class="block space-y-1"
              >
                <span class="text-muted ml-1 text-xs font-semibold"
                  >邮件地址</span
                >
                <input
                  v-model="form.email"
                  type="email"
                  placeholder="example@domain.com"
                  class="text-ink placeholder:text-muted focus:border-accent focus:ring-accent/30 bg-page w-full rounded-xl border px-4 py-2.5 text-sm font-medium ring-2 ring-transparent transition-all outline-none"
                />
              </label>

              <label
                v-if="form.channels.includes('feishu')"
                class="block space-y-1"
              >
                <span class="text-muted ml-1 text-xs font-semibold"
                  >飞书 Webhook URL</span
                >
                <input
                  v-model="form.feishu_webhook_url"
                  type="url"
                  placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
                  class="text-ink placeholder:text-muted focus:border-accent focus:ring-accent/30 bg-page w-full rounded-xl border px-4 py-2.5 text-sm font-medium ring-2 ring-transparent transition-all outline-none"
                />
              </label>

              <label
                v-if="form.channels.includes('bark')"
                class="block space-y-1"
              >
                <span class="text-muted ml-1 text-xs font-semibold"
                  >Bark Device Key</span
                >
                <input
                  v-model="form.bark_device_key"
                  type="text"
                  placeholder="设备Key或完整推送URL"
                  class="text-ink placeholder:text-muted focus:border-accent focus:ring-accent/30 bg-page w-full rounded-xl border px-4 py-2.5 text-sm font-medium ring-2 ring-transparent transition-all outline-none"
                />
              </label>
            </div>

            <!-- Error -->
            <p
              v-if="formError"
              class="text-destructive py-2 text-center text-xs font-medium"
            >
              {{ formError }}
            </p>

            <!-- Submit -->
            <button
              type="submit"
              :disabled="isSubmitting"
              class="bg-accent text-ink hover:shadow-accent/40 shadow-accent/30 flex w-full items-center justify-center gap-2 rounded-full py-4 text-sm font-extrabold shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
            >
              <svg
                v-if="isSubmitting"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                class="h-[18px] w-[18px] animate-spin"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span v-if="isSubmitting">保存中...</span>
              <template v-else>
                <span>保存配置</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="2"
                  stroke="currentColor"
                  class="h-[18px] w-[18px]"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                  />
                </svg>
              </template>
            </button>
          </form>
        </div>
      </div>
    </ModalScaleTransition>
  </Teleport>
</template>

<script setup lang="ts">
import { deviceGateway } from '@/features/device/api/deviceGateway';
import type { Device } from '@/features/device/types';
import { useNotificationStore } from '@/stores';
import { reactive, ref, watch, onMounted } from 'vue';
import { ModalFadeTransition } from '@/components';
import { ModalScaleTransition } from '@/components';

type Channel = 'email' | 'feishu' | 'bark';

interface MilestoneFormState {
  enabled: boolean;
  milestones: number[];
  channels: Channel[];
  email: string;
  feishu_webhook_url: string;
  bark_device_key: string;
}

interface GlobalConfig {
  email?: string;
  feishu_webhook_url?: string;
  bark_device_key?: string;
}

const milestonePresets = [
  { label: '100天', days: 100 },
  { label: '1年', days: 365 },
  { label: '2年', days: 730 },
];

const channelOptions = [
  {
    value: 'email' as Channel,
    label: '邮件',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-[14px] w-[14px]"><path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>`,
  },
  {
    value: 'feishu' as Channel,
    label: '飞书',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-[14px] w-[14px]"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>`,
  },
  {
    value: 'bark' as Channel,
    label: 'Bark',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="h-[14px] w-[14px]"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>`,
  },
];

interface Props {
  modelValue: boolean;
  device: Device;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'success', device: Device): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const notificationStore = useNotificationStore();

function createInitialState(
  device: Device,
  globalConfig?: GlobalConfig | null,
): MilestoneFormState {
  const cfg = device.reminder_config as Record<string, unknown> | undefined;
  return {
    enabled: (cfg?.enabled as boolean) ?? true,
    milestones: Array.isArray(cfg?.milestones)
      ? (cfg.milestones as number[])
      : [100, 365, 730],
    channels: Array.isArray(cfg?.channels)
      ? (cfg.channels as Channel[])
      : ['email'],
    email: (cfg?.email as string) || globalConfig?.email || '',
    feishu_webhook_url:
      (cfg?.feishu_webhook_url as string) ||
      globalConfig?.feishu_webhook_url ||
      '',
    bark_device_key:
      (cfg?.bark_device_key as string) || globalConfig?.bark_device_key || '',
  };
}

function formatMilestone(days: number): string {
  if (days < 365) return `${days}天`;
  const years = Math.floor(days / 365);
  const remaining = days % 365;
  if (remaining === 0) return `${years}年`;
  if (remaining === 182) return `${years}年零半年`;
  return `${years}年${remaining}天`;
}

const form = reactive<MilestoneFormState>(
  createInitialState(props.device, null),
);
const formError = ref<string | null>(null);
const isSubmitting = ref(false);
const testLoading = ref(false);
const customMilestone = ref<number | ''>('');

async function fetchGlobalConfig() {
  try {
    const res = await deviceGateway.getUserGlobalConfig();
    const cfg = res.config as GlobalConfig;
    form.email = form.email || cfg?.email || '';
    form.feishu_webhook_url =
      form.feishu_webhook_url || cfg?.feishu_webhook_url || '';
    form.bark_device_key = form.bark_device_key || cfg?.bark_device_key || '';
  } catch {
    notificationStore.error('获取全局配置失败');
  }
}

onMounted(() => {
  void fetchGlobalConfig();
});

function toggleMilestone(days: number) {
  if (form.milestones.includes(days)) {
    form.milestones = form.milestones.filter((d) => d !== days);
  } else {
    form.milestones = [...form.milestones, days].sort((a, b) => a - b);
  }
}

function addCustomMilestone() {
  const val = customMilestone.value;
  if (!val || val <= 0) return;
  if (form.milestones.includes(val)) {
    customMilestone.value = '';
    return;
  }
  form.milestones = [...form.milestones, val].sort((a, b) => a - b);
  customMilestone.value = '';
}

function toggleChannel(ch: Channel) {
  if (form.channels.includes(ch)) {
    form.channels = form.channels.filter((c) => c !== ch);
  } else {
    form.channels = [...form.channels, ch];
  }
}

async function handleTestNotification() {
  if (testLoading.value) return;
  testLoading.value = true;
  try {
    await deviceGateway.testNotification(props.device.id);
    notificationStore.success('测试通知已发送，请检查您的通知渠道');
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : '测试通知发送失败，请检查配置';
    notificationStore.error(msg);
  } finally {
    testLoading.value = false;
  }
}

async function handleSubmit() {
  formError.value = null;

  if (form.channels.length === 0 && form.enabled) {
    formError.value = '请至少选择一个通知渠道';
    return;
  }
  if (form.milestones.length === 0 && form.enabled) {
    formError.value = '请至少选择一个里程碑';
    return;
  }
  if (form.channels.includes('email') && !form.email.trim()) {
    formError.value = '请填写邮件地址';
    return;
  }
  if (form.channels.includes('feishu') && !form.feishu_webhook_url.trim()) {
    formError.value = '请填写飞书 Webhook 地址';
    return;
  }
  if (form.channels.includes('bark') && !form.bark_device_key.trim()) {
    formError.value = '请填写 Bark Device Key';
    return;
  }

  isSubmitting.value = true;

  const payload = {
    enabled: form.enabled,
    milestones: form.milestones,
    channels: form.channels,
    ...(form.email && { email: form.email.trim() }),
    ...(form.feishu_webhook_url && {
      feishu_webhook_url: form.feishu_webhook_url.trim(),
    }),
    ...(form.bark_device_key && {
      bark_device_key: form.bark_device_key.trim(),
    }),
  };

  try {
    const updated = await deviceGateway.updateDeviceReminderConfig(
      props.device.id,
      payload,
    );
    notificationStore.success('里程碑配置已保存');
    emit('success', updated);
    handleClose();
  } catch (err) {
    const msg = err instanceof Error ? err.message : '保存失败，请稍后重试';
    formError.value = msg;
    notificationStore.error(msg);
  } finally {
    isSubmitting.value = false;
  }
}

function handleClose() {
  emit('update:modelValue', false);
}

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      // Reset form when opening
      Object.assign(form, createInitialState(props.device, null));
      formError.value = null;
      void fetchGlobalConfig();
    }
  },
);
</script>
