<script setup lang="ts">
// L × C 二维热图：在选中的 H 上画 5×5 网格。
// - 行（从上到下）：L = 0.95 → 0.30（亮到暗）
// - 列（从左到右）：C = 0 → 0.32（灰到饱和）
// 当前主色位置加 ring 标注，提示用户在哪个 cell。
import { computed } from 'vue';
import { formatOklch, type Oklch } from '../composables/useOklch';
import type { UseOklchReturn } from '../composables/useOklch';

const props = defineProps<{
  state: UseOklchReturn;
}>();

// 5×5 网格：L 步长 .15（0.30/0.45/0.60/0.75/0.90），C 步长 .08（0/0.08/0.16/0.24/0.32）
const L_VALUES = [0.92, 0.78, 0.65, 0.5, 0.36] as const;
const C_VALUES = [0, 0.08, 0.16, 0.24, 0.32] as const;

interface Cell {
  L: number;
  C: number;
  css: string;
}

const cells = computed<Cell[]>(() => {
  const H = props.state.H.value;
  const out: Cell[] = [];
  for (const L of L_VALUES) {
    for (const C of C_VALUES) {
      out.push({
        L,
        C,
        css: formatOklch({ L, C, H } as Oklch),
      });
    }
  }
  return out;
});

const currentCellIndex = computed(() => {
  const targetL = props.state.L.value;
  const targetC = props.state.C.value;
  // 找最近 cell（直接匹配 or 最接近）
  let best = 0;
  let bestDist = Infinity;
  cells.value.forEach((c, i) => {
    const dL = c.L - targetL;
    const dC = c.C - targetC;
    const d = dL * dL + dC * dC;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
});

function pick(cell: Cell) {
  props.state.setOklch({ L: cell.L, C: cell.C, H: props.state.H.value });
}
</script>

<template>
  <div
    class="bg-card/70 space-y-4 rounded-xl border p-5 shadow-sm backdrop-blur"
  >
    <div class="flex items-baseline justify-between">
      <h3 class="text-ink text-sm font-semibold tracking-wider uppercase">
        L × C Map · 亮/饱和网格
      </h3>
      <span class="text-muted font-mono text-[10px]">
        固定 H = {{ state.H.value.toFixed(0) }}°
      </span>
    </div>
    <p class="text-muted -mt-2 text-xs leading-relaxed">
      行 = 亮度 L（亮→暗），列 = 饱和度 C（灰→鲜）。当前主色用 ring
      标出，点击任意 cell 即替换。
    </p>

    <div class="flex gap-3">
      <!-- Y 轴标签 -->
      <div
        class="text-muted flex flex-col-reverse justify-between py-1 font-mono text-[10px] tabular-nums"
      >
        <span v-for="L in L_VALUES" :key="L">L {{ L.toFixed(2) }}</span>
      </div>

      <!-- 网格 + X 轴标签 -->
      <div class="flex-1 space-y-1">
        <div class="grid grid-cols-5 gap-1.5">
          <button
            v-for="(c, i) in cells"
            :key="i"
            type="button"
            class="/30 aspect-square rounded-md border shadow-inner transition-transform hover:scale-105"
            :class="{
              'ring-accent ring-2 ring-offset-2 ring-offset-[var(--card-bg)]':
                i === currentCellIndex,
            }"
            :style="{ background: c.css }"
            :title="`L=${c.L} C=${c.C} · ${c.css}`"
            :aria-label="`L ${c.L} C ${c.C}`"
            @click="pick(c)"
          />
        </div>
        <div
          class="text-muted grid grid-cols-5 gap-1.5 pt-1 font-mono text-[10px] tabular-nums"
        >
          <span v-for="C in C_VALUES" :key="C" class="text-center">
            C {{ C.toFixed(2) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
