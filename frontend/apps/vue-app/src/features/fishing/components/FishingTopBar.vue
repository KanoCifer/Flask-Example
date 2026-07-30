<script setup lang="ts">
defineOptions({ name: 'FishingTopBar' });
import { useRoute } from 'vue-router';

/**
 * 钓点图鉴顶栏导航项。
 * `to` 缺省表示该分区尚未落地——渲染为不可点击的占位，
 * 先把信息架构摆出来，路由随后续任务逐个接入。
 */
interface FishingNavItem {
  label: string;
  ariaLabel: string;
  to?: string;
}

// 顺序对齐图鉴式设计稿；目前仅「地图」有真实路由。
const navItems: FishingNavItem[] = [
  { label: '总览', ariaLabel: '总览' },
  { label: '地图', ariaLabel: '钓点地图', to: '/fishing-map' },
  { label: '笔记', ariaLabel: '钓行笔记' },
  { label: '装备', ariaLabel: '装备清单' },
  { label: '图鉴进度', ariaLabel: '图鉴进度' },
  { label: '关于', ariaLabel: '关于钓点图鉴' },
];

const route = useRoute();

const isActive = (to: string) =>
  route.path === to || route.path.startsWith(`${to}/`);
</script>

<template>
  <nav
    aria-label="主导航"
    class="border-border bg-surface/80 sticky top-0 z-50 border-b backdrop-blur-md"
  >
    <div
      class="mx-auto flex max-w-screen-2xl items-center gap-10 px-4 py-3 sm:px-6"
    >
      <!-- 品牌 mark -->
      <RouterLink
        to="/"
        aria-label="返回首页"
        class="text-ink font-family-averia shrink-0 text-2xl leading-none transition-[transform] duration-150 ease-out active:scale-[0.96]"
      >
        野
      </RouterLink>

      <ul class="flex items-center gap-6 text-sm">
        <li v-for="item in navItems" :key="item.label">
          <RouterLink
            v-if="item.to"
            :to="item.to"
            :aria-label="item.ariaLabel"
            :aria-current="isActive(item.to) ? 'page' : undefined"
            class="border-b-2 pb-1 leading-none transition-colors duration-150"
            :class="
              isActive(item.to)
                ? 'text-accent border-accent'
                : 'text-ink/70 hover:text-ink border-transparent'
            "
          >
            {{ item.label }}
          </RouterLink>
          <!-- 占位分区：可见但不可达，hover 无反馈 -->
          <span
            v-else
            :aria-label="item.ariaLabel"
            aria-disabled="true"
            title="即将上线"
            class="text-muted cursor-not-allowed border-b-2 border-transparent pb-1 leading-none select-none"
          >
            {{ item.label }}
          </span>
        </li>
      </ul>
    </div>
  </nav>
</template>
