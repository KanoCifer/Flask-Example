<template>
  <div
    @click="openUserMenu"
    @mouseenter="openUserMenu"
    @mouseleave="closeUserMenu"
    class="mb-8 flex items-center gap-4 rounded-3xl p-2 px-2 transition-colors"
  >
    <!-- 下拉菜单 -->
    <DropdownTransition>
      <div
        v-if="isUserMenuOpen"
        class="bg-page absolute top-16 right-0 z-9999 mt-2 w-auto rounded-2xl p-1 shadow-xl ring-1 ring-black/5 dark:ring-white/10"
      >
        <ol>
          <li v-for="(item, idx) in visibleItems" :key="idx">
            <!-- 分隔线 -->
            <div v-if="item.divider" class="bg-border mx-2 my-1 h-px" />
            <!-- 路由链接 -->
            <RouterLink
              v-else-if="item.to"
              :to="item.to"
              @click="closeUserMenuImmediately"
              class="text-ink hover:bg-surface hover:text-ink focus-visible:ring-ring flex items-center gap-2.5 rounded-xl px-3 py-2 font-serif text-sm transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
              :class="item.class"
            >
              <component :is="item.icon" class="h-4 w-4 shrink-0" />
              {{ item.label }}
            </RouterLink>
            <!-- 操作按钮 -->
            <button
              v-else
              @click.prevent="handleItemClick(item)"
              :disabled="item.disabled"
              class="text-ink hover:bg-surface hover:text-ink focus-visible:ring-ring flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 font-serif text-sm transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
              :class="item.class"
            >
              <component :is="item.icon" class="h-4 w-4 shrink-0" />
              {{ item.label }}
            </button>
          </li>
        </ol>
      </div>
    </DropdownTransition>

    <!-- 头像 -->
    <img
      v-if="auth.isAuthenticated && auth.user?.photo"
      :src="avatarUrl"
      :alt="currentUserName"
      class="h-14 w-14 rounded-full object-cover shadow-sm ring-4 ring-white/50 dark:ring-gray-700/50"
    />
    <img
      v-else
      src="/images/about-thumb.webp"
      alt="Default Avatar"
      class="h-14 w-14 rounded-full object-cover shadow-sm ring-4 ring-white/50 dark:ring-gray-700/50"
    />

    <!-- 用户名 -->
    <div class="flex items-baseline gap-2">
      <span
        class="text-ink dark:text-ink font-serif text-2xl font-bold whitespace-nowrap"
      >
        {{ currentUserName }}
      </span>
      <ChevronDownIcon
        class="text-ink h-3 w-3 transform-gpu transition-transform"
        :class="{ 'rotate-180': isUserMenuOpen }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { DropdownTransition } from '@/components';
import { ChevronDownIcon } from '@/components';
import { useAuthStore } from '@/features/auth';
import type { Component } from 'vue';
import { computed, onUnmounted, ref } from 'vue';

export interface DropdownItem {
  icon?: Component;
  label?: string;
  to?: string;
  onClick?: () => void;
  divider?: boolean;
  disabled?: boolean;
  /** 仅在管理员时显示 */
  adminOnly?: boolean;
  /** 额外的 CSS class */
  class?: string;
}

const props = defineProps<{
  items: DropdownItem[];
  guestItems?: DropdownItem[];
}>();

const auth = useAuthStore();

const isUserMenuOpen = ref(false);
let userMenuCloseTimeout: ReturnType<typeof setTimeout> | null = null;

const currentUserName = computed(() => {
  return auth.isAuthenticated ? auth.user?.name || '用户' : '游客';
});

const visibleItems = computed(() => {
  if (!auth.isAuthenticated) return props.guestItems ?? [];
  return props.items.filter((item) => !item.adminOnly || auth.user?.is_admin);
});

const openUserMenu = () => {
  if (userMenuCloseTimeout) {
    clearTimeout(userMenuCloseTimeout);
    userMenuCloseTimeout = null;
  }
  isUserMenuOpen.value = true;
};

const closeUserMenu = () => {
  userMenuCloseTimeout = setTimeout(() => {
    isUserMenuOpen.value = false;
  }, 150);
};

const closeUserMenuImmediately = () => {
  if (userMenuCloseTimeout) {
    clearTimeout(userMenuCloseTimeout);
    userMenuCloseTimeout = null;
  }
  isUserMenuOpen.value = false;
};

const handleItemClick = (item: DropdownItem) => {
  closeUserMenuImmediately();
  item.onClick?.();
};

const avatarUrl = computed(() => {
  if (auth.user?.photo?.startsWith('http')) {
    return auth.user.photo;
  }
  if (auth.user?.photo) {
    return `/v3/media/${auth.user.photo}`;
  }
  return '/v3/media/default.png';
});

onUnmounted(() => {
  if (userMenuCloseTimeout) {
    clearTimeout(userMenuCloseTimeout);
  }
});
</script>
