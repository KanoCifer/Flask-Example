<script setup lang="ts">
// 大色块 + oklch/hex/rgb 三个值 + 一键复制 + 色域警示。
//
// 复制走 navigator.clipboard；通过 hint 提示已复制内容（用 role="status" 走 a11y）。
import { ref } from 'vue';
import { contrastRatio, type Rgb } from '../composables/useOklch';
import type { UseOklchReturn } from '../composables/useOklch';

const props = defineProps<{
  state: UseOklchReturn;
  /** 用于对比度测试的对端颜色（默认 --page 的 RGB） */
  contrastBg?: Rgb | null;
  contrastBgLabel?: string;
}>();

const hint = ref<string | null>(null);
let hintTimer: ReturnType<typeof setTimeout> | null = null;

function showHint(text: string) {
  hint.value = text;
  if (hintTimer) clearTimeout(hintTimer);
  hintTimer = setTimeout(() => {
    hint.value = null;
  }, 1400);
}

async function copy(value: string) {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return;
  try {
    await navigator.clipboard.writeText(value);
    showHint(`已复制 ${value}`);
  } catch {
    showHint('复制失败');
  }
}

const swatchStyle = () => ({
  background: props.state.oklchString.value,
});

const contrast = () => {
  if (!props.contrastBg) return null;
  const ratio = contrastRatio(
    {
      r: props.state.rgb.value.r,
      g: props.state.rgb.value.g,
      b: props.state.rgb.value.b,
    },
    props.contrastBg,
  );
  return ratio;
};

const contrastGrade = (ratio: number) => {
  if (ratio >= 7) return { label: 'AAA', tone: 'success' as const };
  if (ratio >= 4.5) return { label: 'AA', tone: 'success' as const };
  if (ratio >= 3) return { label: 'AA Large', tone: 'warning' as const };
  return { label: 'Fail', tone: 'destructive' as const };
};

const outOfGamut = () => !props.state.rgb.value.inGamut;

defineOptions({
  name: 'OklchPreviewCard',
});
</script>

<template>
  <div
    class="bg-card/70 relative overflow-hidden rounded-xl border shadow-sm backdrop-blur"
  >
    <!-- 大色块 -->
    <div class="relative aspect-[5/3] w-full" :style="swatchStyle()">
      <span
        v-if="outOfGamut()"
        class="bg-warning/90 text-on-accent absolute top-3 left-3 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase shadow-sm"
        :title="`输入 C=${state.C.value.toFixed(3)}，实际显示 C=${state.rgb.value.usedC.toFixed(3)}`"
      >
        out of sRGB
      </span>
      <span
        v-if="hint"
        class="bg-accent text-on-accent pointer-events-none absolute top-3 right-3 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase shadow-sm"
        role="status"
        aria-live="polite"
      >
        {{ hint }}
      </span>
    </div>

    <!-- 值列表 -->
    <div class="text-ink space-y-1.5 p-4 font-mono text-xs">
      <button
        type="button"
        class="hover:bg-secondary/60 group flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left transition-colors"
        :title="`复制 ${state.oklchString.value}`"
        @click="copy(state.oklchString.value)"
      >
        <span class="text-muted">oklch</span>
        <span class="text-ink truncate">{{ state.oklchString.value }}</span>
      </button>
      <button
        type="button"
        class="hover:bg-secondary/60 group flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left transition-colors"
        :title="`复制 ${state.hex.value}`"
        @click="copy(state.hex.value)"
      >
        <span class="text-muted">hex</span>
        <span class="text-ink">{{ state.hex.value }}</span>
      </button>
      <button
        type="button"
        class="hover:bg-secondary/60 group flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left transition-colors"
        :title="`复制 ${state.rgbString.value}`"
        @click="copy(state.rgbString.value)"
      >
        <span class="text-muted">rgb</span>
        <span class="text-ink">{{ state.rgbString.value }}</span>
      </button>
    </div>

    <!-- 对比度 -->
    <div v-if="contrastBg" class="space-y-1.5 border-t px-4 py-3 text-xs">
      <div class="text-muted flex items-baseline justify-between">
        <span>对比度 · vs {{ contrastBgLabel ?? 'bg' }}</span>
        <span
          v-if="contrast() !== null"
          :class="[
            'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase',
            contrastGrade(contrast()!).tone === 'success' &&
              'bg-success/15 text-success',
            contrastGrade(contrast()!).tone === 'warning' &&
              'bg-warning/15 text-warning',
            contrastGrade(contrast()!).tone === 'destructive' &&
              'bg-destructive/15 text-destructive',
          ]"
        >
          {{ contrastGrade(contrast()!).label }} · {{ contrast()!.toFixed(2) }}
        </span>
      </div>
      <div
        class="rounded px-2 py-1.5"
        :style="{
          background: state.oklchString.value,
          color: '#fff',
        }"
      >
        Aa 字体大小 14px · 浅底深字
      </div>
      <div
        class="rounded px-2 py-1.5"
        :style="{
          background: state.oklchString.value,
          color: '#000',
        }"
      >
        Aa 字体大小 14px · 浅底黑字
      </div>
    </div>
  </div>
</template>
