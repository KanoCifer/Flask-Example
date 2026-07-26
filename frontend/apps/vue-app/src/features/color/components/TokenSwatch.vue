<script setup lang="ts">
// 单个 token 色板 — 显示色块、变量名、解析色。
import { computed } from 'vue';

const props = defineProps<{
  /** CSS 变量名（不含 var()） */
  name: string;
  /** 解析后的颜色字面量（来自 getComputedStyle） */
  value: string;
  /** 中文/英文标签（默认等于 name） */
  label?: string;
}>();

const swatchStyle = computed(() => ({
  background: `var(--${props.name})`,
}));

const copyValue = async () => {
  if (
    !props.value ||
    typeof navigator === 'undefined' ||
    !navigator.clipboard
  ) {
    return;
  }
  try {
    await navigator.clipboard.writeText(props.value);
  } catch {
    // 静默失败 — 配色工坊不是关键路径
  }
};
</script>

<template>
  <button
    type="button"
    class="bg-card/40 hover:bg-card/70 group flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors"
    :title="`点击复制 ${value}`"
    @click="copyValue"
  >
    <span
      class="/60 h-8 w-8 shrink-0 rounded-md border shadow-inner"
      :style="swatchStyle"
    />
    <span class="flex min-w-0 flex-1 flex-col gap-0.5">
      <span class="text-ink truncate text-xs font-semibold">
        {{ label ?? name }}
      </span>
      <span class="text-muted truncate font-mono text-xs leading-tight">
        --{{ name }}
      </span>
    </span>
    <span
      class="text-muted/70 group-hover:text-muted hidden max-w-[180px] shrink-0 truncate text-right font-mono text-xs sm:inline-block"
      :title="value"
    >
      {{ value || '—' }}
    </span>
  </button>
</template>
