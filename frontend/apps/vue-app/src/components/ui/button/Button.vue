<script setup lang="ts">
import { computed } from 'vue';
import {
  buttonClasses,
  type ButtonVariant,
  type ButtonSize,
} from './buttonClasses';

interface Props {
  /** 渲染元素；默认 button，传 'a' 时渲染 <a> 并接收 href/target/rel/download。 */
  as?: 'button' | 'a';
  /** 原生 `<button>` 的 type 属性。仅 as='button' 生效。 */
  type?: 'button' | 'submit' | 'reset';
  /** 视觉变体（配色 + 边框），见 design-system.md。 */
  variant?: ButtonVariant;
  /** 预设尺寸（高 / 内距 / 间距）；不传则由调用方通过 class 自定 padding。 */
  size?: ButtonSize;
  /** 禁用态；与 base 里的 disabled:* 样式联动。仅 as='button' 生效。 */
  disabled?: boolean;
  /** 链接目标。仅 as='a' 生效。 */
  href?: string;
  target?: string;
  rel?: string;
  download?: boolean | string;
}

const {
  as = 'button',
  type = 'button',
  variant = 'default',
  size,
  disabled = false,
  href,
  target,
  rel,
  download,
} = defineProps<Props>();

const classes = computed(() => buttonClasses({ variant, size }));
</script>

<template>
  <button
    v-if="as === 'button'"
    data-slot="button"
    :type="type"
    :disabled="disabled"
    :class="classes"
  >
    <slot />
  </button>
  <a
    v-else
    data-slot="button"
    :href="href"
    :target="target"
    :rel="rel"
    :download="download"
    :class="classes"
  >
    <slot />
  </a>
</template>
