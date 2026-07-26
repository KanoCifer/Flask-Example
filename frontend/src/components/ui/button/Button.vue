<script setup lang="ts">
import { computed } from 'vue';
import {
  buttonClasses,
  type ButtonVariant,
  type ButtonSize,
} from './buttonClasses';

interface Props {
  /** 原生 `<button>` 的 type 属性。 */
  type?: 'button' | 'submit' | 'reset';
  /** 视觉变体（配色 + 边框），见 design-system.md。 */
  variant?: ButtonVariant;
  /** 预设尺寸（高 / 内距 / 间距）；不传则由调用方通过 class 自定 padding。 */
  size?: ButtonSize;
  /** 禁用态；与 base 里的 disabled:* 样式联动。 */
  disabled?: boolean;
}

const {
  type = 'button',
  variant = 'default',
  size,
  disabled = false,
} = defineProps<Props>();

const classes = computed(() => buttonClasses({ variant, size }));
</script>

<template>
  <button data-slot="button" :type="type" :disabled="disabled" :class="classes">
    <slot />
  </button>
</template>
