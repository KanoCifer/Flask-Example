<template>
  <BentoCard>
    <div class="p-4">
      <h3 class="text-muted mb-3 text-xs font-bold tracking-wider uppercase">
        Tags
      </h3>
      <p v-if="isLoading" class="text-muted text-xs">加载中…</p>
      <p v-else-if="tags.length === 0" class="text-muted text-xs">暂无标签</p>
      <ul v-else class="space-y-1">
        <li>
          <button
            @click="selectTag(null)"
            :class="[
              'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
              activeTag === null
                ? 'bg-accent/15 text-ink font-medium'
                : 'text-muted hover:bg-surface hover:text-ink',
            ]"
          >
            <span class="flex items-center gap-2">
              <IconTags class="size-4" />
              全部文章
            </span>
            <span class="text-muted text-xs">
              {{ totalPosts }}
            </span>
          </button>
        </li>
        <li v-for="tag in tags" :key="tag.name">
          <button
            @click="selectTag(tag.name)"
            :class="[
              'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
              activeTag === tag.name
                ? 'bg-accent/15 text-ink font-medium'
                : 'text-muted hover:bg-surface hover:text-ink',
            ]"
          >
            <span class="flex items-center gap-2">
              <IconTags class="size-4" />
              {{ tag.name }}
            </span>
            <span class="text-muted text-xs">{{ tag.count }}</span>
          </button>
        </li>
      </ul>
    </div>
  </BentoCard>
</template>

<script setup lang="ts">
import { BentoCard } from '@/components';
import { IconTags } from '@/components';
import { blogGateway } from '@/features/blog/api/blogGateway';
import type { BlogPost, Post, TagItem } from '@/features/blog/types';
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const tags = ref<TagItem[]>([]);
const activeTag = ref<string | null>(null);
const totalPosts = ref<number | null>(null);
const isLoading = ref(false);

const emit = defineEmits<{
  filterPosts: [posts: Post[], tagName: string];
  resetFilter: [];
}>();

onMounted(async () => {
  await fetchTags();
  const tag = route.query.tag;
  if (typeof tag === 'string' && tag) {
    activeTag.value = tag;
    await fetchPostsByTag(tag);
  }
});

watch(
  () => route.query.tag,
  async (newTag) => {
    if (typeof newTag === 'string' && newTag) {
      activeTag.value = newTag;
      await fetchPostsByTag(newTag);
    } else if (newTag === undefined || newTag === null || newTag === '') {
      activeTag.value = null;
      emit('resetFilter');
    }
  },
);

const fetchTags = async () => {
  isLoading.value = true;
  try {
    tags.value = await blogGateway.getTags();
    totalPosts.value = tags.value.reduce((sum, t) => sum + t.count, 0);
  } catch (error) {
    console.error('Failed to fetch tags:', error);
  } finally {
    isLoading.value = false;
  }
};

const fetchPostsByTag = async (tag: string) => {
  try {
    const response = await blogGateway.getPostsByTag(tag);
    const posts: BlogPost[] = response.posts as unknown as BlogPost[];
    emit('filterPosts', posts as unknown as Post[], tag);
  } catch (error) {
    console.error('Failed to fetch posts by tag:', error);
  }
};

const selectTag = (tag: string | null) => {
  activeTag.value = tag;
  if (tag !== null) {
    router.replace({ query: { ...route.query, tag } });
    fetchPostsByTag(tag);
  } else {
    const query = { ...route.query };
    delete query.tag;
    router.replace({ query });
    emit('resetFilter');
  }
};
</script>
