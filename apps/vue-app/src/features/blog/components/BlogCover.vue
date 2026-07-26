<template>
  <div
    :class="[
      'relative overflow-hidden rounded-xl',
      '/60 bg-surface border',
      sizeClasses,
    ]"
  >
    <!-- 真实封面 -->
    <img
      v-if="cover"
      :src="coverSrc"
      :alt="title"
      class="absolute inset-0 h-full w-full object-cover"
      loading="lazy"
    />

    <!-- 占位：picsum.photos + 文学手账覆盖层 -->
    <template v-else>
      <img
        :src="placeholderUrl"
        :alt="`${title} 封面占位`"
        class="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
      />

      <!-- 顶部到底部加深渐变，保证底部文字可读 -->
      <div
        class="absolute inset-0 bg-gradient-to-b from-black/10 via-black/0 to-black/65"
        aria-hidden="true"
      />

      <!-- 顶部条：分类 + 章节标 -->
      <div
        class="text-ink/95 absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 sm:p-3.5"
      >
        <span
          v-if="categoryName"
          class="bg-accent/85 inline-flex max-w-[60%] items-center rounded-full px-2 py-0.5 font-serif text-[10px] tracking-wide shadow-sm"
        >
          <span class="mr-0.5">#</span>
          <span class="truncate">{{ categoryName }}</span>
        </span>
        <span
          class="text-ink/75 ml-auto font-mono text-[10px] tracking-[0.2em] uppercase"
          >{{ chapterLabel }}</span
        >
      </div>

      <!-- 底部：标题（衬线）+ 装饰小线 + 副标斜体 -->
      <div class="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-3 sm:p-4">
        <div class="flex items-center gap-1.5">
          <div class="bg-accent/70 h-px w-5" />
          <span
            class="text-ink/80 font-serif text-[10px] tracking-[0.2em] italic"
            >cover</span
          >
        </div>
        <h3
          v-if="title"
          :class="[
            'text-ink font-serif leading-tight font-semibold drop-shadow-sm',
            titleClass,
          ]"
          style="text-wrap: balance"
        >
          {{ title }}
        </h3>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { useOrigin } from '@/composables';
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    /** 真实封面 URL；留空时使用占位图 */
    cover?: string | null;
    /** 文章标题（占位时叠在图上） */
    title: string;
    /** picsum 的 seed，稳定来自 post._id */
    seed?: string | number;
    /** 分类名，会作为占位顶部小标 */
    categoryName?: string;
    /** 视觉尺寸：sm 卡内缩略、md 普通卡、lg featured */
    size?: 'sm' | 'md' | 'lg';
  }>(),
  {
    cover: null,
    seed: '',
    categoryName: '',
    size: 'md',
  },
);

// 非 http(s) 开头的 src 用 https://api.kanocifer.chat 作为前缀（仅在 https 环境下生效）
const coverSrc = computed(() => (props.cover ? useOrigin(props.cover) : ''));

// 稳定 hash：用作 picsum seed
const seedHash = computed(() => {
  const raw = String(props.seed ?? props.title ?? '');
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = (h * 31 + raw.charCodeAt(i)) | 0;
  }
  // 字母前缀，picsum 对字母 / 数字都接受
  return `kanocifer-${Math.abs(h).toString(36)}`;
});

// picsum 占位：3:4 比例，按 size 选合适分辨率
const placeholderUrl = computed(() => {
  const [w, h] =
    props.size === 'lg'
      ? [600, 800]
      : props.size === 'sm'
        ? [300, 400]
        : [400, 533];
  return `https://picsum.photos/seed/${seedHash.value}/${w}/${h}`;
});

// 章节序号 No.001 / No.002 ... 稳定来自 seed
const chapterLabel = computed(() => {
  const n =
    (Number.parseInt(seedHash.value.replace(/\D/g, '').slice(0, 4) || '0', 36) %
      999) +
    1;
  return `No.${String(n).padStart(3, '0')}`;
});

const titleClass = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'text-xs line-clamp-2';
    case 'lg':
      return 'text-lg sm:text-xl line-clamp-3';
    case 'md':
    default:
      return 'text-sm sm:text-[15px] line-clamp-2';
  }
});

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'aspect-[3/4] w-full';
    case 'lg':
      return 'aspect-[3/4] w-full';
    case 'md':
    default:
      return 'aspect-[3/4] w-full';
  }
});
</script>
