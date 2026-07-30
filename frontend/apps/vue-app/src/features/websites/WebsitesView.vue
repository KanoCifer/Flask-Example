<template>
  <BasicDetail :title="heroTitle" :subtitle="heroSubtitle">
    <div class="col-span-full mx-auto w-full max-w-6xl">
      <!-- 分类筛选条 -->
      <div
        role="tablist"
        aria-label="网站分类"
        class="bg-page/40 mb-10 flex flex-wrap items-center gap-2 rounded-full border p-1.5 shadow-sm sm:mb-12"
      >
        <button
          v-for="opt in filterOptions"
          :key="opt.slug"
          type="button"
          role="tab"
          :aria-selected="activeSlug === opt.slug"
          :tabindex="activeSlug === opt.slug ? 0 : -1"
          class="focus-visible:ring-ring inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-[background-color,color] duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none sm:px-4 sm:text-[0.9375rem]"
          :class="
            activeSlug === opt.slug
              ? 'bg-accent text-contrast shadow-sm'
              : 'text-muted hover:bg-surface hover:text-ink'
          "
          @click="setCategory(opt.slug)"
        >
          <span>{{ opt.label }}</span>
          <span
            class="text-xs tabular-nums"
            :class="
              activeSlug === opt.slug ? 'text-contrast/70' : 'text-muted/70'
            "
          >
            {{ opt.count }}
          </span>
        </button>
      </div>

      <!-- 空状态 -->
      <div
        v-if="visibleSites.length === 0"
        class="bg-page/30 flex flex-col items-center justify-center rounded-4xl border py-20"
      >
        <IconGlobeOutline class="text-muted mb-5 h-16 w-16" />
        <p class="text-ink font-serif text-lg">这个抽屉还没添东西。</p>
        <p class="text-muted mt-2 text-sm">
          试试别的分类，或者
          <button
            type="button"
            class="text-ink focus-visible:ring-ring rounded-sm underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:outline-none"
            @click="setCategory('all')"
          >
            全部展开
          </button>
          。
        </p>
      </div>

      <!-- 按分类分组渲染 -->
      <section
        v-for="group in groupedSites"
        :key="group.category"
        :aria-labelledby="`group-${group.slug}`"
        class="mb-12 last:mb-0"
      >
        <header class="mb-6 flex items-baseline gap-3">
          <h2
            :id="`group-${group.slug}`"
            class="text-ink font-serif text-2xl font-medium tracking-tight sm:text-[1.625rem]"
          >
            {{ group.category }}
          </h2>
          <span
            class="bg-border h-px flex-1 translate-y-[-2px]"
            aria-hidden="true"
          ></span>
          <span
            class="text-muted text-xs font-medium tracking-wide tabular-nums"
          >
            {{ group.sites.length }} 个
          </span>
        </header>

        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <motion.a
            v-for="site in group.sites"
            :key="site.id"
            :initial="{ opacity: 0, y: 10 }"
            :whileInView="WHILE_IN_VIEW_FADE_UP"
            :transition="SPRING_REVEAL"
            :while-hover="HOVER_LIFT"
            :href="site.url"
            target="_blank"
            rel="noopener noreferrer"
            class="group bg-page/40 hover:border-accent/40 hover:bg-page/60 focus-visible:ring-ring relative block cursor-pointer overflow-hidden rounded-3xl border p-6 shadow-sm transition-[background-color,border-color,box-shadow] duration-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <!-- 顶部：图标 + 名称 + 分类 chip -->
            <div class="mb-4 flex items-start gap-3">
              <div
                class="bg-surface flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl transition-transform duration-300 group-hover:scale-105"
              >
                <img
                  v-if="site.icon"
                  :src="site.icon"
                  :alt="site.name"
                  class="h-7 w-7 object-contain"
                  @error="handleImageError"
                />
                <IconGlobeOutline v-else class="text-muted h-6 w-6" />
              </div>
              <div class="min-w-0 flex-1">
                <h3
                  class="text-ink font-serif text-lg leading-snug font-medium"
                >
                  {{ site.name }}
                </h3>
                <span
                  class="bg-accent/10 text-ink mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                >
                  {{ site.category }}
                </span>
              </div>
            </div>

            <!-- 中段：note（书房语气的视觉重心） -->
            <p class="text-ink/85 mb-3 text-sm leading-relaxed text-pretty">
              <span class="text-ink/70 font-serif" aria-hidden="true">「</span>
              {{ site.note }}
              <span class="text-ink/70 font-serif" aria-hidden="true">」</span>
            </p>

            <!-- 底段：description + tags -->
            <p class="text-muted mb-4 line-clamp-2 text-xs leading-relaxed">
              {{ site.description }}
            </p>

            <div v-if="site.tags?.length" class="flex flex-wrap gap-1.5">
              <TagPill v-for="tag in site.tags.slice(0, 4)" :key="tag" compact>
                {{ tag }}
              </TagPill>
            </div>

            <!-- 外链箭头 -->
            <IconExternalLink
              class="text-muted/60 group-hover:text-ink/80 absolute top-5 right-5 h-4 w-4 shrink-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              aria-hidden="true"
            />
          </motion.a>
        </div>
      </section>
    </div>
  </BasicDetail>
</template>

<script setup lang="ts">
import { BasicDetail, TagPill } from '@/components';
import { websitesData } from '@/data';
import { useImageError } from '@/composables';
import { motion } from 'motion-v';
import { SPRING_REVEAL, WHILE_IN_VIEW_FADE_UP, HOVER_LIFT } from '@/constants';
import { computed, ref } from 'vue';
import { useUrlSearchParams } from '@vueuse/core';
import { IconExternalLink, IconGlobeOutline } from '@/components';
import type { Website } from './types';

interface CategoryOption {
  slug: string;
  label: string;
  category: string;
}

const { handleImageError } = useImageError();

const sites: Website[] = websitesData.sites as Website[];

// 分类顺序按数据原序去重（保持JSON顺序），并把"全部"作为首位
const filterOptions = computed<Array<CategoryOption & { count: number }>>(
  () => {
    const counts = new Map<string, number>();
    const order = new Map<string, number>();
    sites.forEach((s, i) => {
      counts.set(s.category, (counts.get(s.category) ?? 0) + 1);
      if (!order.has(s.category)) {
        order.set(s.category, i);
      }
    });
    const ordered = Array.from(order.entries())
      .sort(([, a], [, b]) => a - b)
      .map(([category]) => ({
        slug: slugify(category),
        label: category,
        category,
        count: counts.get(category)!,
      }));

    return [
      { slug: 'all', label: '全部', category: 'all', count: sites.length },
      ...ordered,
    ];
  },
);

// URL 同步 ?category=
const params = useUrlSearchParams('history');
const activeSlug = ref<string>(
  typeof params.category === 'string' ? params.category : 'all',
);

const setCategory = (slug: string) => {
  activeSlug.value = slug;
  if (slug === 'all') {
    delete params.category;
  } else {
    params.category = slug;
  }
};

// 按 slug 过滤 + 按分类分组
const visibleSites = computed<Website[]>(() => {
  if (activeSlug.value === 'all') return sites;
  const opt = filterOptions.value.find((o) => o.slug === activeSlug.value);
  if (!opt || opt.category === 'all') return sites;
  return sites.filter((s) => s.category === opt.category);
});

const groupedSites = computed<
  Array<{ slug: string; category: string; sites: Website[] }>
>(() => {
  const buckets = new Map<string, Website[]>();
  visibleSites.value.forEach((s) => {
    if (!buckets.has(s.category)) buckets.set(s.category, []);
    buckets.get(s.category)!.push(s);
  });
  return Array.from(buckets.entries()).map(([category, list]) => ({
    slug: slugify(category),
    category,
    sites: list,
  }));
});

// Hero 文案：总数 + 当前分类
const heroTitle = '推荐网站';
const heroSubtitle = computed(() => {
  const total = `${sites.length} 个`;
  const opt = filterOptions.value.find((o) => o.slug === activeSlug.value);
  if (!opt || opt.slug === 'all') {
    return `网站推介 · ${total} · 慢慢翻`;
  }
  return `网站推介 · ${total} · 当前：${opt.label}`;
});

// 工具：把中文分类转拼音/英文 slug 太重，这里用类目自身的稳定 key
// 用类目字符串本身作为 fallback slug（如果用户未通过筛选条点过，无 ?category= 也无需 slug）
function slugify(category: string): string {
  const map: Record<string, string> = {
    全部: 'all',
    工具: 'tools',
    资源: 'resources',
    个人项目: 'personal',
    文档: 'docs',
    开发: 'dev',
  };
  return map[category] ?? category;
}
</script>
