<template>
  <section id="rss-parse" class="bg-card rounded-2xl border p-6">
    <div class="mb-5 flex items-center justify-between gap-3">
      <div>
        <h2 class="text-ink text-xl font-bold">解析订阅地址</h2>
        <p class="text-muted mt-1 text-sm">
          支持 RSS/Atom，解析后可直接保存到我的订阅
        </p>
      </div>
    </div>

    <form
      class="flex flex-col gap-4 lg:flex-row lg:items-end"
      @submit.prevent="$emit('parse')"
    >
      <div class="flex-1">
        <label for="rss-url" class="text-ink mb-2 block text-sm font-medium">
          RSS/Atom 地址
        </label>
        <input
          id="rss-url"
          :value="rssUrl"
          type="text"
          placeholder="https://example.com/feed.xml"
          class="bg-page text-ink placeholder:text-muted focus:border-accent focus:ring-accent/20 w-full rounded-xl border px-4 py-3 transition-all focus:ring-2 focus:outline-none"
          @input="
            $emit('update:rssUrl', ($event.target as HTMLInputElement).value)
          "
        />
      </div>

      <button
        type="button"
        class="border-accent/30 bg-accent/15 text-ink hover:bg-surface rounded-xl border px-5 py-3 text-sm font-medium transition-colors"
        @click="$emit('update:saveToDb', !saveToDb)"
      >
        {{ saveToDb ? '已启用保存' : '保存到订阅' }}
      </button>

      <button
        type="submit"
        :disabled="parseLoading"
        class="bg-warning text-ink hover:bg-warning/90 focus:ring-warning disabled:hover:bg-warning rounded-xl px-6 py-3 text-sm font-semibold transition-all focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-70"
      >
        {{ parseLoading ? '解析中...' : '开始解析' }}
      </button>
    </form>

    <div class="mt-4 flex flex-wrap items-center gap-2">
      <span class="text-muted text-sm">快捷尝试:</span>
      <button
        v-for="feed in exampleFeeds"
        :key="feed.url"
        type="button"
        class="bg-accent/15 text-ink hover:bg-surface rounded-full px-3 py-1 text-xs font-medium transition-colors"
        @click="$emit('update:rssUrl', feed.url)"
      >
        {{ feed.name }}
      </button>
    </div>

    <div
      v-if="rssHistory.length > 0"
      class="mt-3 flex flex-wrap items-center gap-2"
    >
      <span class="text-muted text-sm">历史记录:</span>
      <button
        v-for="historyUrl in rssHistory.slice(0, 3)"
        :key="historyUrl"
        type="button"
        class="bg-accent/15 text-ink hover:bg-surface rounded-full px-3 py-1 text-xs font-medium transition-colors"
        @click="$emit('update:rssUrl', historyUrl)"
      >
        {{ historyUrl }}
      </button>
    </div>

    <div v-if="parseMetadata" class="bg-surface/40 mt-6 rounded-xl border p-5">
      <h3 class="text-ink text-lg font-bold">
        {{ parseMetadata.title }}
      </h3>
      <p v-if="parseMetadata.description" class="text-muted mt-2 text-sm">
        {{ parseMetadata.description }}
      </p>
      <div class="text-muted mt-3 flex flex-wrap items-center gap-3 text-xs">
        <span v-if="parseMetadata.published"
          >更新时间: {{ formatDate(parseMetadata.published) }}</span
        >
        <a
          :href="parseMetadata.link"
          target="_blank"
          rel="noopener noreferrer"
          class="text-ink hover:text-ink font-medium"
        >
          访问原站
        </a>
      </div>
    </div>

    <div v-if="parseEntries.length > 0" class="mt-5 space-y-3">
      <div class="text-ink text-sm font-semibold">
        最新解析文章（{{ parseEntries.length }}）
      </div>
      <ul class="space-y-2">
        <li
          v-for="(entry, index) in parseEntries"
          :key="`${entry.link}-${index}`"
          class="bg-card rounded-xl border p-4"
        >
          <a
            :href="entry.link"
            target="_blank"
            rel="noopener noreferrer"
            class="text-ink hover:text-ink font-medium transition-colors"
          >
            {{ entry.title }}
          </a>
          <p v-if="entry.summary" class="text-muted mt-2 line-clamp-2 text-sm">
            {{ truncateSummary(entry.summary) }}
          </p>
          <div class="text-muted mt-2 text-xs">
            {{ formatDate(entry.published) }}
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { truncateSummary } from '../rssUtils';
import { formatDate } from '@/lib/dayjs';
import type { ExampleFeed } from '../rssUtils';

export interface RssMetadata {
  title: string;
  description: string;
  link: string;
  published?: string | null;
}

export interface RssEntry {
  title: string;
  link: string;
  summary: string;
  published: string | null;
  content?: string;
}

defineProps<{
  rssUrl: string;
  saveToDb: boolean;
  parseLoading: boolean;
  parseMetadata: RssMetadata | null;
  parseEntries: RssEntry[];
  exampleFeeds: ExampleFeed[];
  rssHistory: string[];
}>();

defineEmits<{
  'update:rssUrl': [value: string];
  'update:saveToDb': [value: boolean];
  parse: [];
}>();
</script>
