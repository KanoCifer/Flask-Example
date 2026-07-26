<script setup lang="ts">
// 和谐关系配色预览 —— 5 种关系，6 行。
// 每行：3-5 个色块 + 关系说明。
// 单击色块把它的 OKLCH 拉成主色（同时也会更新所有其它视图）。
import { computed } from 'vue';
import {
  buildHarmony,
  formatOklch,
  oklchToRgb,
  rgbToHex,
  type HarmonyKind,
} from '../composables/useOklch';
import type { UseOklchReturn } from '../composables/useOklch';

const props = defineProps<{
  state: UseOklchReturn;
}>();

const KINDS: { key: HarmonyKind; name: string; description: string }[] = [
  {
    key: 'analogous',
    name: 'Analogous · 类比',
    description: '色相 ±30°，柔和过渡，做主题辅色很合适',
  },
  {
    key: 'complementary',
    name: 'Complementary · 互补',
    description: '色相 +180°，强对比，用于主色 vs 强调色',
  },
  {
    key: 'triadic',
    name: 'Triadic · 三等分',
    description: '色相 0/120/240°，三色均匀分布',
  },
  {
    key: 'splitComplement',
    name: 'Split-Complement · 分裂互补',
    description: '色相 +150°/+210°，比纯互补更柔和',
  },
  {
    key: 'tetradic',
    name: 'Tetradic · 四方',
    description: '色相 0/+90/+180/+270°，矩形配色',
  },
  {
    key: 'monochromatic',
    name: 'Monochromatic · 单色',
    description: '同色相，按 L 分层（4 档）',
  },
];

const current = computed(() => props.state.oklch.value);

const rows = computed(() =>
  KINDS.map((k) => {
    const variants = buildHarmony(current.value, k.key);
    return {
      ...k,
      variants: variants.map((v) => {
        const rgb = oklchToRgb(v.oklch);
        return {
          ...v,
          hex: rgbToHex(rgb),
          css: formatOklch(v.oklch),
        };
      }),
    };
  }),
);

function applyVariant(oklch: { L: number; C: number; H: number }) {
  props.state.setOklch(oklch);
}
</script>

<template>
  <div
    class="bg-card/70 space-y-4 rounded-xl border p-5 shadow-sm backdrop-blur"
  >
    <div class="flex items-baseline justify-between">
      <h3 class="text-ink text-sm font-semibold tracking-wider uppercase">
        Harmony · 配色关系
      </h3>
      <span class="text-muted font-mono text-[10px]">点击色块替换主色</span>
    </div>

    <div class="space-y-3">
      <div
        v-for="row in rows"
        :key="row.key"
        class="/40 space-y-1.5 rounded-lg border p-2.5"
      >
        <div class="flex items-baseline justify-between gap-2">
          <div class="text-ink text-xs font-semibold">{{ row.name }}</div>
          <div class="text-muted truncate text-[11px]">
            {{ row.description }}
          </div>
        </div>
        <div class="flex gap-1.5">
          <button
            v-for="(v, i) in row.variants"
            :key="`${row.key}-${i}`"
            type="button"
            class="/40 hover:ring-ring group flex h-10 flex-1 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-md border shadow-inner transition-all hover:ring-2"
            :style="{ background: v.css }"
            :title="`${v.label} · ${v.css}`"
            @click="applyVariant(v.oklch)"
          >
            <span
              class="text-ink rounded-full bg-[var(--card-bg)]/80 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider uppercase shadow-sm"
            >
              {{ v.label }}
            </span>
            <span
              class="text-muted rounded-full bg-[var(--card-bg)]/80 px-1.5 py-0.5 font-mono text-[9px] shadow-sm"
            >
              {{ v.hex }}
            </span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
