<script setup lang="ts">
// 在 4 scheme × 2 theme = 8 个底色上预览当前 OKLCH 作为前景的对比度。
//
// 做法：挂一个离屏 probe，依次置 data-color-scheme + .dark，
// 用 getComputedStyle 读 --page / --card-bg 等底色 token，转 RGB 后算 WCAG 对比度。
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { COLOR_SCHEMES, useThemeStore, type ColorScheme } from '@/stores';
import { contrastRatio, type Rgb } from '../composables/useOklch';
import type { UseOklchReturn } from '../composables/useOklch';

interface Cell {
  scheme: ColorScheme;
  dark: boolean;
  paper: Rgb;
  cardBg: Rgb;
  surface: Rgb;
}

const themeStore = useThemeStore();

const cells = ref<Cell[]>([]);
let probe: HTMLDivElement | null = null;

function readTokenRgb(tokenName: string): Rgb {
  if (!probe) return { r: 255, g: 255, b: 255 };
  const raw = window.getComputedStyle(probe).getPropertyValue(tokenName).trim();
  // 走浏览器自身 oklch → sRGB 解析：把 raw 丢给 <canvas>.fillStyle 再回读
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return { r: 255, g: 255, b: 255 };
  ctx.fillStyle = '#000';
  try {
    ctx.fillStyle = raw;
  } catch {
    return { r: 255, g: 255, b: 255 };
  }
  const resolved = ctx.fillStyle as string;
  if (!resolved.startsWith('#') || resolved.length !== 7) {
    return { r: 255, g: 255, b: 255 };
  }
  return {
    r: parseInt(resolved.slice(1, 3), 16),
    g: parseInt(resolved.slice(3, 5), 16),
    b: parseInt(resolved.slice(5, 7), 16),
  };
}

function recompute() {
  if (typeof document === 'undefined') return;
  if (!probe) {
    probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.position = 'absolute';
    probe.style.left = '-9999px';
    probe.style.top = '0';
    probe.style.width = '1px';
    probe.style.height = '1px';
    probe.style.pointerEvents = 'none';
    document.body.appendChild(probe);
  }
  const next: Cell[] = [];
  for (const scheme of COLOR_SCHEMES) {
    for (const dark of [false, true]) {
      probe.setAttribute('data-color-scheme', scheme);
      probe.classList.toggle('dark', dark);
      next.push({
        scheme,
        dark,
        paper: readTokenRgb('--page'),
        cardBg: readTokenRgb('--card-bg'),
        surface: readTokenRgb('--surface'),
      });
    }
  }
  cells.value = next;
}

onMounted(recompute);

onBeforeUnmount(() => {
  probe?.remove();
  probe = null;
});

// 主题/scheme 变化重算
watch(
  () => themeStore.scheme,
  () => recompute(),
);
watch(
  () => themeStore.theme,
  () => recompute(),
);

const fgRgb = computed<Rgb>(() => {
  const { r, g, b } = props.state.rgb.value;
  return { r, g, b };
});

const grade = (ratio: number) => {
  if (ratio >= 7) return { label: 'AAA', tone: 'success' as const };
  if (ratio >= 4.5) return { label: 'AA', tone: 'success' as const };
  if (ratio >= 3) return { label: 'AA-L', tone: 'warning' as const };
  return { label: '✗', tone: 'destructive' as const };
};

const props = defineProps<{
  state: UseOklchReturn;
}>();

const surfaceFor = (cell: Cell) => cell.paper;
const ratioFor = (cell: Cell) =>
  contrastRatio(fgRgb.value, surfaceFor(cell)).toFixed(2);
</script>

<template>
  <div
    class="bg-card/70 space-y-4 rounded-xl border p-5 shadow-sm backdrop-blur"
  >
    <div class="flex items-baseline justify-between">
      <h3 class="text-ink text-sm font-semibold tracking-wider uppercase">
        Contrast Matrix · 主题对比
      </h3>
      <span class="text-muted font-mono text-[10px]">
        4 scheme × light/dark = 8 cells
      </span>
    </div>
    <p class="text-muted -mt-2 text-xs leading-relaxed">
      当前 OKLCH 作为前景，在每个 scheme 的
      <code class="bg-secondary rounded px-1 font-mono text-[10px]"
        >--page</code
      >
      底色上的 WCAG 对比度。
    </p>

    <div class="grid grid-cols-2 gap-2 md:grid-cols-4">
      <div
        v-for="cell in cells"
        :key="`${cell.scheme}-${cell.dark}`"
        class="/40 overflow-hidden rounded-lg border shadow-sm"
      >
        <div
          class="px-2.5 py-1.5 text-[10px] tracking-wider uppercase"
          :style="{
            background: `rgb(${cell.paper.r}, ${cell.paper.g}, ${cell.paper.b})`,
            color:
              (cell.paper.r + cell.paper.g + cell.paper.b) / 3 > 128
                ? 'rgba(0,0,0,0.7)'
                : 'rgba(255,255,255,0.9)',
          }"
        >
          {{ cell.scheme }} · {{ cell.dark ? 'dark' : 'light' }}
        </div>
        <div
          class="flex items-center justify-between px-2.5 py-2"
          :style="{
            background: state.oklchString.value,
            color: `rgb(${cell.paper.r}, ${cell.paper.g}, ${cell.paper.b})`,
          }"
        >
          <span class="truncate text-xs font-semibold">Aa 文字</span>
          <span
            :class="[
              'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase',
              grade(contrastRatio(fgRgb, cell.paper)).tone === 'success' &&
                'bg-success/20 text-success',
              grade(contrastRatio(fgRgb, cell.paper)).tone === 'warning' &&
                'bg-warning/20 text-warning',
              grade(contrastRatio(fgRgb, cell.paper)).tone === 'destructive' &&
                'bg-destructive/20 text-destructive',
            ]"
          >
            {{ grade(contrastRatio(fgRgb, cell.paper)).label }}
            · {{ ratioFor(cell) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
