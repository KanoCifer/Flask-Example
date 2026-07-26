<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :class="['inline-block', $attrs.class as string]"
    fill="none"
    viewBox="0 0 24 24"
    stroke-width="1.8"
    stroke="currentColor"
    aria-hidden="true"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      d="M12 2.25l2.6 4.95 5.4.6-4.05 3.7 1.1 5.45L12 14.1l-5.05 2.85 1.1-5.45-4.05-3.7 5.4-.6L12 2.25z"
    />
  </svg>
</template>

<script setup lang="ts">
// PinIcon — 装饰用五角小图章；与日历、删除等小图标同尺寸（h-4 w-4 起）。
defineOptions({ inheritAttrs: false });
</script>
