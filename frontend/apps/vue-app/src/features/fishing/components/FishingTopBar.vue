<script setup lang="ts">
defineOptions({ name: 'FishingTopBar' });
import { useRoute } from 'vue-router';
import { Plus } from '@lucide/vue';
import { Button } from '@/components';

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

defineProps<{
  analysisOpen: boolean;
  analysisHasData: boolean;
}>();

defineEmits<{
  'toggle-analysis': [];
  'add-spot': [];
}>();

// 顺序对齐图鉴式设计稿；目前仅「地图」「天气」有真实路由。
const navItems: FishingNavItem[] = [
  { label: '总览', ariaLabel: '总览' },
  { label: '地图', ariaLabel: '钓点地图', to: '/fishing-map' },
  { label: '天气', ariaLabel: '天气与渔情', to: '/fishing-map/weather' },
  { label: '笔记', ariaLabel: '钓行笔记' },
  { label: '装备', ariaLabel: '装备清单' },
  { label: '图鉴进度', ariaLabel: '图鉴进度' },
  { label: '关于', ariaLabel: '关于钓点图鉴' },
];

const route = useRoute();

/**
 * 精确匹配 —— /fishing-map 现在是布局父路径，前缀匹配会让「地图」在
 * /fishing-map/weather 上一起高亮。仅容忍末尾斜杠差异。
 */
const isActive = (to: string) => route.path.replace(/\/+$/, '') === to;
</script>

<template>
  <nav aria-label="主导航" class="bg-page/70 z-50 backdrop-blur-md">
    <div
      class="mx-auto flex max-w-screen-2xl items-center gap-10 px-4 py-3 sm:px-6"
    >
      <!-- 品牌 mark -->
      <RouterLink
        to="/"
        aria-label="返回首页"
        class="text-ink font-family-averia inline-flex shrink-0 items-center gap-1.5 text-2xl leading-none transition-[transform] duration-150 ease-out active:scale-[0.96]"
      >
        <span class="brand-mark">Ka</span>
        Luring
        <span class="text-muted font-serif text-xs tracking-[0.2em] italic">
          ka·no·ci·fer
        </span>
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

      <div class="mr-4 ml-auto flex items-center gap-2">
        <Button size="md" @click="$emit('add-spot')">
          <Plus class="h-4 w-4" aria-hidden="true" />
          <span class="hidden sm:inline">添加钓点</span>
        </Button>

        <Button
          size="md"
          variant="outline"
          :class="analysisOpen ? 'border-accent text-ink bg-accent/5' : ''"
          :aria-pressed="analysisOpen"
          @click="$emit('toggle-analysis')"
        >
          <span class="relative inline-flex">
            <svg
              height="20px"
              style="flex: none; line-height: 1"
              viewBox="0 0 24 24"
              width="20px"
              xmlns="http://www.w3.org/2000/svg"
            >
              <title>DeepSeek</title>
              <path
                d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z"
                fill="#4D6BFE"
              ></path>
            </svg>
            <span
              v-if="analysisHasData && !analysisOpen"
              class="bg-success ring-card absolute -top-1 -right-1 inline-flex h-2 w-2 rounded-full ring-2"
              aria-hidden="true"
            />
          </span>
          <span class="hidden sm:inline">AI 分析</span>
        </Button>
      </div>
    </div>
  </nav>
</template>

<style lang="scss" scoped>
.brand-mark {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--accent);
  color: white;
  display: grid;
  place-items: center;
  font-weight: 600;
  font-size: 16px;
}
</style>
