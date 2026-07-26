<template>
  <div
    class="transition-transform duration-800 ease-out"
    :class="!floatingIn ? 'translate-x-full' : 'translate-x-0'"
  >
    <!-- Settings button -->
    <div class="fixed top-4 right-4 z-50 flex flex-col gap-2">
      <button
        @click="$emit('openSettings')"
        @mouseenter="isSettingsHovered = true"
        @mouseleave="isSettingsHovered = false"
        class="fab group bg-secondary hover:bg-accent"
        aria-label="偏好设置"
      >
        <motion.div
          class="flex items-center justify-center"
          :animate="{ rotate: isSettingsHovered ? 180 : 0 }"
          :transition="{
            type: 'spring',
            stiffness: 400,
            damping: 25,
            delay: 0.3,
          }"
        >
          <Settings class="fab-icon text-ink group-hover:text-contrast" />
        </motion.div>
        <span class="fab-label">偏好设置</span>
      </button>
    </div>

    <!-- New Post button -->
    <div class="fixed top-16 right-4 z-50 flex flex-col gap-2">
      <button
        @click="goToNewPost"
        class="fab group bg-accent hover:bg-accent/90 text-contrast"
        aria-label="写文章"
      >
        <Plus class="fab-icon" />
        <span class="fab-label">新建</span>
      </button>
    </div>

    <!-- Like button -->
    <div class="fixed top-28 right-4 z-50 flex flex-col gap-2">
      <button
        @click="handleLike"
        @mouseenter="isHeartHovered = true"
        @mouseleave="isHeartHovered = false"
        :class="[
          'fab group text-contrast',
          liked ? 'bg-rose-500' : 'bg-accent hover:bg-rose-500',
        ]"
        aria-label="点赞"
      >
        <motion.div
          class="flex items-center justify-center"
          :animate="isHeartHovered ? { scale: [1, 1.25, 1] } : { scale: 1 }"
          :transition="{ duration: 0.4, ease: 'easeInOut' }"
        >
          <Heart class="fab-icon" :class="liked ? 'fill-current' : ''" />
        </motion.div>
        <span class="fab-label">{{ likesCount }}</span>
      </button>
    </div>

    <!-- Friend links button -->
    <div class="fixed top-40 right-4 z-50 flex flex-col gap-2">
      <button
        @click="$emit('goToFriendLinks')"
        class="fab group bg-secondary hover:bg-accent"
        aria-label="友情链接"
      >
        <Link2 class="fab-icon text-ink group-hover:text-contrast" />
        <span class="fab-label">友链</span>
      </button>
    </div>

    <!-- Edit Layout button -->
    <div class="fixed top-52 right-4 z-50 flex flex-col gap-2">
      <button
        @click="toggleEditLayout"
        class="fab group bg-secondary hover:bg-accent"
        :aria-label="layoutStore.isEditing ? '退出编辑' : '编辑布局'"
      >
        <Pencil class="fab-icon text-ink group-hover:text-contrast" />
        <span class="fab-label">编辑布局</span>
      </button>
    </div>

    <!-- Switch to mobile button -->
    <div class="fixed top-64 right-4 z-50 flex flex-col gap-2">
      <button
        @click="$emit('switchToMobile')"
        class="fab group bg-secondary hover:bg-accent"
        aria-label="切换到移动版"
      >
        <Smartphone class="fab-icon text-ink group-hover:text-contrast" />
        <span class="fab-label">移动版</span>
      </button>
    </div>

    <!-- RSS button -->
    <div class="fixed top-76 right-4 z-50 flex flex-col gap-2">
      <button
        @click="goToRss"
        class="fab group bg-secondary hover:bg-accent"
        aria-label="RSS"
      >
        <Rss class="fab-icon text-ink group-hover:text-contrast" />
        <span class="fab-label">RSS</span>
      </button>
    </div>

    <!-- Subscription button -->
    <div class="fixed top-88 right-4 z-50 flex flex-col gap-2">
      <button
        @click="goToSubscription"
        class="fab group bg-secondary hover:bg-accent"
        aria-label="订阅管理"
      >
        <CreditCard class="fab-icon text-ink group-hover:text-contrast" />
        <span class="fab-label">订阅</span>
      </button>
    </div>

    <!-- Image Toolbox button -->
    <div class="fixed top-100 right-4 z-50 flex flex-col gap-2">
      <button
        @click="goToImageToolbox"
        class="fab group bg-secondary hover:bg-accent"
        aria-label="图片工具"
      >
        <Wrench class="fab-icon text-ink group-hover:text-contrast" />
        <span class="fab-label">图片工具</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { socialGateway } from '@/features/blog';
import { useCardLayoutStore } from '@/features/entry';
import { useNotificationStore } from '@/stores';
import { AxiosError } from 'axios';
import {
  CreditCard,
  Heart,
  Link2,
  Pencil,
  Plus,
  Rss,
  Settings,
  Smartphone,
  Wrench,
} from '@lucide/vue';
import { motion } from 'motion-v';
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const notifier = useNotificationStore();
const layoutStore = useCardLayoutStore();
const floatingIn = ref(false);

const liked = ref(false);
const likesCount = ref(0);
const isHeartHovered = ref(false);
const isSettingsHovered = ref(false);

function toggleEditLayout() {
  if (layoutStore.isEditing) {
    layoutStore.cancelEditing();
  } else {
    layoutStore.startEditing();
  }
}

const goToNewPost = () => {
  router.push('/blog/new');
};

const handleLike = async () => {
  try {
    await socialGateway.likeOnce({ likes_count: 1 });
    liked.value = true;
    likesCount.value += 1;
    notifier.success('感谢你的喜欢 ❤️');
  } catch (error) {
    let errorMsg = '点赞失败，请稍后重试';
    if (error instanceof AxiosError) {
      if (error.response?.status === 429) {
        errorMsg = '🥳今天已经点赞很多次啦，明天再试试吧！';
      }
    }
    notifier.error(errorMsg);
    console.error('Failed to update likes count:', error);
  }
};

const goToRss = () => {
  router.push('/rss');
};

const goToSubscription = () => {
  router.push('/subscription');
};

const goToImageToolbox = () => {
  router.push('/toolbox/image-toolbox');
};

onMounted(() => {
  setTimeout(() => {
    floatingIn.value = true;
  }, 800);

  socialGateway
    .getLikes()
    .then((response) => {
      likesCount.value = response.likes_count || 0;
    })
    .catch(() => {
      notifier.error('获取点赞数失败，请稍后再试');
    });
});

defineEmits<{
  (e: 'openSettings'): void;
  (e: 'goToFriendLinks'): void;
  (e: 'switchToMobile'): void;
}>();
</script>

<style scoped>
.fab {
  display: flex;
  height: 2.5rem;
  align-items: center;
  overflow: hidden;
  border-radius: 9999px;
  padding: 0 0.625rem;
  cursor: pointer;
  transition: transform 300ms ease-out;
}

.fab-icon {
  height: 1.25rem;
  width: 1.25rem;
  flex-shrink: 0;
  transition: color 300ms ease-out;
}

.fab-label {
  max-width: 0;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  font-size: 0.875rem;
  font-weight: 500;
  opacity: 0;
  color: white;
  transition:
    max-width 300ms ease-out,
    margin 300ms ease-out,
    opacity 300ms ease-out;
}

.fab:hover {
  transform: scale(1);
}

.fab:hover .fab-label {
  max-width: 10rem;
  margin-left: 0.375rem;
  opacity: 1;
}

.fab:active {
  transform: scale(0.96);
}

@media (prefers-reduced-motion: reduce) {
  .fab,
  .fab-icon,
  .fab-label {
    transition-duration: 0ms;
  }
}
</style>
