<script setup lang="ts">
import { fishingGateway } from '@/features/fishing/api';
import { useNotificationStore } from '@/stores';
import type {
  FishingFeedbackData,
  FishingFeedbackLevel,
  FishingFeedbackPayload,
} from '@/features/fishing/types';
import dayjs from 'dayjs';
import { nextTick, ref, watch } from 'vue';
import { Button } from '@/components';

interface Props {
  isOpen: boolean;
  fishingData: FishingFeedbackData;
  locationId: string;
  locationName: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'success'): void;
  (e: 'cancel'): void;
}>();

const FEEDBACK_OPTIONS: { value: FishingFeedbackLevel; label: string }[] = [
  { value: '爆护', label: '爆护' },
  { value: '好', label: '好' },
  { value: '一般', label: '一般' },
  { value: '差', label: '差' },
  { value: '空军', label: '空军' },
];

const notifier = useNotificationStore();
const loading = ref(false);
const selectedFeedback = ref<FishingFeedbackLevel | null>(null);

// 弹窗进出动画:显隐状态与入场/出场类解耦,出场动画播完才移除 DOM
const visible = ref(false);
const isOpen = ref(false);
let closeTimer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => props.isOpen,
  (val) => {
    if (val) {
      visible.value = true;
      if (closeTimer) {
        clearTimeout(closeTimer);
        closeTimer = null;
      }
      nextTick(() => {
        isOpen.value = true;
      });
    } else {
      isOpen.value = false;
      const closeMs =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            '--modal-close-dur',
          ),
        ) || 150;
      closeTimer = setTimeout(() => {
        visible.value = false;
        closeTimer = null;
      }, closeMs);
    }
  },
  { immediate: true },
);

function handleCancel() {
  if (!loading.value) emit('cancel');
}

const handleSubmit = async () => {
  if (!selectedFeedback.value) {
    notifier.error('请选择钓鱼体验');
    return;
  }

  loading.value = true;

  try {
    const payload: FishingFeedbackPayload = {
      location_id: props.locationId,
      location_name: props.locationName,
      fishing_time: dayjs().toISOString(),
      feedback: selectedFeedback.value,
      temperature: props.fishingData.temperature,
      humidity: props.fishingData.humidity,
      pressure: props.fishingData.pressure,
      wind_speed: props.fishingData.wind_speed,
      precipitation: props.fishingData.precipitation,
      indices: props.fishingData.indices,
      tide_level: props.fishingData.tide_level,
      tide_type: props.fishingData.tide_type,
      tide_range: props.fishingData.tide_range,
      hours_to_next_tide: props.fishingData.hours_to_next_tide,
    };
    await fishingGateway.postFishingFeedback(payload);

    notifier.success('反馈已提交，感谢您的分享！');
    selectedFeedback.value = null;
    emit('success');
  } catch (err) {
    const message = err instanceof Error ? err.message : '提交反馈失败，请重试';
    notifier.error(message);
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <teleport to="body">
    <div
      v-if="visible"
      class="t-modal-overlay"
      :class="{ 'is-open': isOpen }"
      role="dialog"
      aria-modal="true"
      aria-label="钓鱼反馈"
      @click.self="handleCancel"
    >
      <div class="t-modal" :class="{ 'is-open': isOpen }">
        <h3 class="text-ink mb-4 text-lg font-semibold">
          钓鱼反馈
          <span class="text-muted ml-2 text-sm font-normal"
            >你的反馈会帮助我们改进</span
          >
        </h3>

        <div class="bg-surface mb-4 rounded-lg p-3 text-sm">
          <p class="text-muted">地点: {{ locationName }}</p>
          <p class="text-muted">
            当前指数: {{ fishingData.fishing_index }} ({{ fishingData.level }})
          </p>
        </div>

        <div class="space-y-4">
          <div>
            <label class="text-ink mb-2 block text-sm font-medium"
              >您的钓鱼体验</label
            >
            <div class="grid grid-cols-3 gap-2">
              <Button
                v-for="option in FEEDBACK_OPTIONS"
                :key="option.value"
                type="button"
                class="rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                :class="
                  selectedFeedback === option.value
                    ? 'bg-accent text-ink'
                    : 'bg-surface text-ink hover:bg-surface'
                "
                @click="selectedFeedback = option.value"
              >
                {{ option.label }}
              </Button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <Button
              size="md"
              variant="outline"
              :disabled="loading"
              @click="$emit('cancel')"
            >
              取消
            </Button>
            <Button
              size="md"
              :disabled="!selectedFeedback || loading"
              @click="handleSubmit"
            >
              {{ loading ? '提交中...' : '确认提交' }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
/*
 * t-modal —— transitions.dev modal (scale-up open / softer scale-down close)
 * --modal-* 变量局部定义,仅作用于本弹窗,无全局污染
 */
.t-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: oklch(from var(--muted) l c h / 0.4);
  backdrop-filter: blur(2px);
  --modal-open-dur: 250ms;
  --modal-close-dur: 150ms;
  --modal-scale: 0.96;
  --modal-scale-close: 0.96;
  --modal-ease: cubic-bezier(0.22, 1, 0.36, 1);
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--modal-open-dur) var(--modal-ease);
  will-change: opacity;
}
.t-modal-overlay.is-open {
  opacity: 1;
  pointer-events: auto;
}
.t-modal-overlay:not(.is-open) {
  transition: opacity var(--modal-close-dur) var(--modal-ease);
}

.t-modal {
  transform-origin: center;
  transform: scale(var(--modal-scale));
  opacity: 0;
  pointer-events: none;
  width: 100%;
  max-width: 28rem;
  margin: 0 1rem;
  border-radius: var(--radius-2xl, 1rem);
  background-color: var(--color-page);
  padding: 1.5rem;
  box-shadow: 0 20px 60px -10px oklch(0% 0 0 / 0.25);
  transition:
    transform var(--modal-open-dur) var(--modal-ease),
    opacity var(--modal-open-dur) var(--modal-ease);
  will-change: transform, opacity;
}
.t-modal.is-open {
  transform: scale(1);
  opacity: 1;
  pointer-events: auto;
}
.t-modal:not(.is-open) {
  transform: scale(var(--modal-scale-close));
  opacity: 0;
  pointer-events: none;
  transition:
    transform var(--modal-close-dur) var(--modal-ease),
    opacity var(--modal-close-dur) var(--modal-ease);
}

@media (prefers-reduced-motion: reduce) {
  .t-modal,
  .t-modal-overlay {
    transition: none !important;
  }
}
</style>
