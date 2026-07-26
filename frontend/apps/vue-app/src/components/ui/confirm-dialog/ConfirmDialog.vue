<template>
  <ui-modal :open="open" :size="size" @close="handleCancel">
    <div class="w-full p-6">
      <!-- 图标 + 标题 -->
      <div class="flex items-start gap-3">
        <span
          class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
          :class="variant.iconBg"
        >
          <svg
            class="h-[18px] w-[18px]"
            :class="variant.iconColor"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              :d="variant.iconPath"
            />
          </svg>
        </span>
        <div class="min-w-0 flex-1">
          <h2 class="text-ink text-base font-semibold">{{ title }}</h2>
          <p class="text-muted mt-1 text-sm leading-relaxed">
            {{ message }}
          </p>
        </div>
      </div>

      <!-- 底部按钮 -->
      <div class="mt-5 flex items-center justify-end gap-2">
        <button
          type="button"
          @click="handleCancel"
          class="text-muted hover:bg-surface focus-visible:ring-ring cursor-pointer rounded-lg px-3.5 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {{ cancelText }}
        </button>
        <button
          type="button"
          @click="handleConfirm"
          class="focus-visible:ring-ring cursor-pointer rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          :class="variant.confirmClass"
        >
          {{ confirmText }}
        </button>
      </div>
    </div>
  </ui-modal>
</template>

<script setup lang="ts">
import UiModal from '@/components/ui/modal/Modal.vue';

export type ConfirmVariant = 'default' | 'destructive';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const props = withDefaults(defineProps<Props>(), {
  confirmText: '确认',
  cancelText: '取消',
  variant: 'default',
  size: 'sm',
});

const emit = defineEmits<{
  close: [];
  confirm: [];
}>();

const VARIANT_STYLE = {
  default: {
    iconBg: 'bg-accent/10',
    iconColor: 'text-ink',
    iconPath: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    confirmClass: 'bg-accent text-ink hover:bg-accent/90',
  },
  destructive: {
    iconBg: 'bg-destructive/10',
    iconColor: 'text-destructive',
    iconPath:
      'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z',
    confirmClass:
      'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/30',
  },
};

const variant = VARIANT_STYLE[props.variant];

function handleConfirm() {
  emit('confirm');
}

function handleCancel() {
  emit('close');
}
</script>
