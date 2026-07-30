<template>
  <BentoCard
    :layoutId="props.layoutId"
    :initial="props.initial"
    :animate="props.animate"
    :transition="props.transition"
    :hoverEffect="false"
  >
    <!-- 用户信息 + 下拉菜单 -->
    <UserDropdown :items="userMenuItems" :guest-items="guestMenuItems" />

    <!-- 导航分类 -->
    <div
      class="text-ink dark:text-muted mb-4 px-3 text-sm font-bold tracking-wider"
    >
      GENERAL
    </div>

    <!-- 导航项列表 -->
    <div class="relative">
      <!-- 导航指示器 -->
      <Motion
        class="nav-indicator absolute top-0 left-0 z-0 h-[52px] w-full transform-gpu rounded-3xl will-change-transform"
        :animate="{ y: hoverNavIndex * 56 }"
        :transition="SPRING_BOUNCE"
      />

      <ol class="flex flex-col gap-1">
        <li
          v-for="(item, index) in navItems"
          :key="item.path"
          @mouseenter="hoverNavIndex = index"
        >
          <RouterLink
            :to="item.path"
            class="relative z-10 flex items-center gap-4 rounded-3xl px-6 py-3.5 font-medium transition-colors duration-150 active:scale-[0.98]"
            :class="
              hoverNavIndex === index
                ? 'text-ink'
                : 'text-ink/70 hover:text-ink dark:text-muted dark:hover:text-ink'
            "
          >
            <img
              :src="item.animalSrc"
              :alt="item.label"
              class="h-6 w-6 shrink-0 object-cover"
              loading="lazy"
              decoding="async"
            />
            <span class="text-[15px]">{{ item.label }}</span>
          </RouterLink>
        </li>
      </ol>
    </div>
  </BentoCard>
</template>

<script setup lang="ts">
import { BentoCard } from '@/components';
import {
  IconAnalytics,
  IconUser,
  ImportIcon,
  LoginIcon,
  LogoutIcon,
  RegisterIcon,
} from '@/components';
import { useAuthStore } from '@/features/auth';
import { Motion, type MotionProps } from 'motion-v';
import { SPRING_BOUNCE } from '@/constants';
import { onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { DropdownItem } from './UserDropdown.vue';
import UserDropdown from './UserDropdown.vue';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const props = defineProps<{
  layoutId?: string;
  initial?: MotionProps['initial'];
  animate?: MotionProps['animate'];
  transition?: MotionProps['transition'];
}>();

// 用户菜单项配置（登录态）
const userMenuItems: DropdownItem[] = [
  { icon: IconUser, label: 'Profile', to: '/settings' },
  { icon: ImportIcon, label: 'Import', to: '/import' },
  {
    icon: IconAnalytics,
    label: 'Analytics',
    to: '/analytics',
    adminOnly: true,
  },
  { divider: true },
  {
    icon: LogoutIcon,
    label: 'Logout',
    class: 'text-ink font-bold',
    onClick: () => {
      auth.logout();
      router.push('/');
    },
  },
];

// 用户菜单项配置（未登录——访客）
const guestMenuItems: DropdownItem[] = [
  {
    icon: LoginIcon,
    label: 'Login',
    to: '/login',
  },
  {
    icon: RegisterIcon,
    label: 'Register',
    to: '/register',
  },
];

// 导航项配置：6 个动物徽标 1:1 替代 lucide / 自绘图标
// 语义映射：fox 品牌主 → 首页；cat 沉思 → 文章；panda 安静熬夜 → 书架；
//         rabbit 话痨 → 碎碎念；penguin 出片 → 照片墙；koala 慢节奏 → 关于
const navItems = [
  { path: '/', label: '首页', animalSrc: '/images/animal-badge/fox.png' },
  {
    path: '/blog',
    label: '近期文章',
    animalSrc: '/images/animal-badge/cat.png',
  },
  {
    path: '/bookshelf',
    label: '我的书架',
    animalSrc: '/images/animal-badge/panda.png',
  },
  {
    path: '/moments',
    label: '碎碎念',
    animalSrc: '/images/animal-badge/rabbit.png',
  },
  {
    path: '/gallery',
    label: '照片墙',
    animalSrc: '/images/animal-badge/penguin.png',
  },
  {
    path: '/about',
    label: '关于网站',
    animalSrc: '/images/animal-badge/koala.png',
  },
];

const hoverNavIndex = ref(0);

let navIndexTimer: ReturnType<typeof setTimeout> | null = null;

// 更新活动导航项索引
const updateNavIndex = () => {
  if (navIndexTimer) {
    clearTimeout(navIndexTimer);
  }
  const index = navItems.findIndex((item) => route.path === item.path);
  navIndexTimer = setTimeout(() => {
    if (index !== -1) {
      hoverNavIndex.value = index;
    }
  }, 100);
};

onUnmounted(() => {
  if (navIndexTimer) {
    clearTimeout(navIndexTimer);
  }
});

// 监听路由变化
watch(() => route.path, updateNavIndex, { immediate: true });
</script>

<style scoped>
/* 选中指示器：玻璃凸起的圆角药丸
   半透白底 + 顶部内侧高光 + 底部环境阴影 = 浮在卡片上的玻璃按键感 */
.nav-indicator {
  background: rgb(255 255 255 / 0.5);
  border: 1px solid rgb(255 255 255 / 0.6);
  box-shadow:
    inset 0 1px 1px rgb(255 255 255 / 0.7),
    inset 0 -1px 2px rgb(0 0 0 / 0.03),
    0 3px 8px rgb(0 0 0 / 0.06),
    0 1px 3px rgb(0 0 0 / 0.04);
}

.dark .nav-indicator {
  background: rgb(255 255 255 / 0.1);
  border-color: rgb(255 255 255 / 0.12);
  box-shadow:
    inset 0 1px 1px rgb(255 255 255 / 0.12),
    inset 0 -1px 2px rgb(0 0 0 / 0.1),
    0 3px 8px rgb(0 0 0 / 0.2),
    0 1px 3px rgb(0 0 0 / 0.15);
}
</style>
