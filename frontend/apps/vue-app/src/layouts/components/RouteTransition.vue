<template>
  <RouterView v-slot="{ Component }">
    <template v-if="isEntryView">
      <component :is="Component" :key="viewKey" />
    </template>
    <Transition v-else :name="transitionName" mode="out-in">
      <div :key="viewKey" :style="directionStyle">
        <component :is="Component" />
      </div>
    </Transition>
  </RouterView>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { CSSProperties } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  resolvePageSlideDirection,
  resolveTransitionName,
} from '@/lib';

defineOptions({ name: 'RouteTransition' });

const { entryPath = '/' } = defineProps<{
  entryPath?: string;
}>();

const route = useRoute();
const router = useRouter();

const transitionName = computed(() =>
  resolveTransitionName(route.meta.transition),
);
const isEntryView = computed(() => route.path === entryPath);

/**
 * 过渡 / 重建的粒度。
 *
 * 普通路由按完整 path —— 换页即重建，行为不变。
 * 带 children 的布局路由（如 /fishing-map）按父级 record keying：
 * 子页之间切换 key 不变，布局壳（顶栏、浮层、共享状态）留在原地，
 * 只由壳内层的 RouterView 换主体；否则这里的 key 会把整棵子树连壳一起重建。
 */
const viewKey = computed(() => {
  const root = route.matched[0];
  return root && root.children.length > 0 ? root.path : route.path;
});

/**
 * page-side-by-side 进入方向：来自 router.history.state.back。
 * - 列表 → 详情/编辑器：正向（+1，进入从右）
 * - 详情/编辑器 → 列表：反向（-1，进入从左）
 * - 首屏 / 同层：兜底正向
 * 仅 page-side-by-side 需要此 style；其余动画返回空对象。
 */
const directionStyle = computed<CSSProperties>(() => {
  if (transitionName.value !== 'page-side-by-side') return {};
  const direction = resolvePageSlideDirection(
    (router.options.history.state as { back?: string | null } | undefined)
      ?.back ?? null,
    route.path,
  );
  return { '--page-slide-direction': direction };
});
</script>