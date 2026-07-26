<template>
  <span
    class="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full select-none"
    :class="sizeClass"
    :title="`用户 ${userId}`"
    :aria-label="`用户 ${userId}`"
  >
    <img
      v-if="useAnimal"
      :src="animalSrc"
      :alt="`用户 ${userId}`"
      class="h-full w-full object-cover"
      loading="lazy"
    />
    <span
      v-else
      :class="[bgClass, textClass]"
      class="flex h-full w-full items-center justify-center font-medium"
    >
      {{ initials }}
    </span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    userId: number;
    /** 头像尺寸。xs 用在筛选 chip / 泳道标签（保留首字母，raster 在 20px 不可读）；sm/md 用动物徽标。 */
    size?: 'xs' | 'sm' | 'md';
  }>(),
  { size: 'sm' },
);

// ── 尺寸 ──
// xs：12px 文字，h-5；sm：14px 文字，h-7；md：16px 文字，h-9
const sizeClass = computed(() => {
  switch (props.size) {
    case 'xs':
      return 'h-5 w-5 text-[10px]';
    case 'md':
      return 'h-9 w-9 text-sm';
    default:
      return 'h-7 w-7 text-xs';
  }
});

// ── 动物徽标集 ──
// 哈希到 6 张里抽一张；缺图时仍 fallback 到首字母。
// fox 出现频率最高（与全站吉祥物一致）。
const ANIMAL_BADGES = [
  { src: '/images/animal-badge/fox.png', alt: 'fox' },
  { src: '/images/animal-badge/panda.png', alt: 'panda' },
  { src: '/images/animal-badge/koala.png', alt: 'koala' },
  { src: '/images/animal-badge/rabbit.png', alt: 'rabbit' },
  { src: '/images/animal-badge/dog.png', alt: 'dog' },
  { src: '/images/animal-badge/penguin.png', alt: 'penguin' },
] as const;

const hash32 = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return Math.abs(h);
};

const animalIdx = computed(
  () => hash32(String(props.userId)) % ANIMAL_BADGES.length,
);
const animalSrc = computed(() => ANIMAL_BADGES[animalIdx.value]!.src);
// xs 档位用首字母（20px 装不下 raster 细节）；sm/md 用动物徽标。
const useAnimal = computed(() => props.size !== 'xs');

// ── 兜底色板 ──
// animal PNG 加载失败时回退到这一组，仍然 deterministic。
interface AvatarPalette {
  bg: string;
  text: string;
}
const PALETTES: AvatarPalette[] = [
  {
    bg: 'bg-blue-100 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
  },
  {
    bg: 'bg-emerald-100 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
  {
    bg: 'bg-amber-100 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
  },
  {
    bg: 'bg-rose-100 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
  },
  {
    bg: 'bg-purple-100 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
  },
  {
    bg: 'bg-teal-100 dark:bg-teal-950/40',
    text: 'text-teal-700 dark:text-teal-300',
  },
];

const palette = computed<AvatarPalette>(() => {
  const idx = hash32(String(props.userId) + ':palette') % PALETTES.length;
  return PALETTES[idx]!;
});

const bgClass = computed(() => palette.value.bg);
const textClass = computed(() => palette.value.text);

// ── 首字母 —— 没有姓名数据，用 "U" + userId 末两位作为头像缩写 ──
const initials = computed(() => {
  const id = props.userId;
  if (id < 10) return `U${id}`;
  return `U${id % 100}`.padStart(2, '0').slice(-2);
});
</script>
