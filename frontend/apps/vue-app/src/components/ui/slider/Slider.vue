<script setup lang="ts">
/**
 * Slider：基于原生 <input type="range">。
 * - 浏览器自带的 a11y、键盘、pointer、RTL、触屏行为直接复用。
 * - 支持 :default-value / :min / :max / :step / v-model。
 * - v-model 接收 number（单 thumb）或 number[]（多 thumb，兼容 shadcn 语义）。
 */
import type { HTMLAttributes } from 'vue';
import { computed } from 'vue';

type SliderValue = number | number[];

interface Props {
  modelValue?: SliderValue;
  defaultValue?: SliderValue;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  name?: string;
  class?: HTMLAttributes['class'];
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  defaultValue: 0,
  min: 0,
  max: 100,
  step: 1,
  disabled: false,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: SliderValue): void;
}>();

const isArray = computed(
  () => Array.isArray(props.modelValue) || Array.isArray(props.defaultValue),
);

const internal = computed<number>(() => {
  if (props.modelValue !== undefined) {
    return Array.isArray(props.modelValue)
      ? props.modelValue[0]
      : props.modelValue;
  }
  return Array.isArray(props.defaultValue)
    ? props.defaultValue[0]
    : props.defaultValue;
});

function onInput(e: Event) {
  const v = Number((e.target as HTMLInputElement).value);
  emit('update:modelValue', isArray.value ? [v] : v);
}

defineOptions({
  name: 'UiSlider',
});
</script>

<template>
  <input
    type="range"
    :value="internal"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    :name="name"
    data-slot="slider"
    :class="[
      'border-input bg-surface/30 ring-ring/30 focus-visible:ring-ring/40 h-1.5 w-full cursor-pointer appearance-none rounded-full outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50',
      '[&::-webkit-slider-thumb]:border-accent [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:transition-[color,box-shadow] [&::-webkit-slider-thumb]:hover:ring-4 [&::-webkit-slider-thumb]:focus-visible:ring-4',
      '[&::-moz-range-thumb]:border-accent [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-sm',
      props.class,
    ]"
    @input="onInput"
  />
</template>
