<script setup lang="ts">
import { Button } from '@/components';
/**
 * Dashboard 顶部 sticky header。
 *
 * 替换原 view 里散落的 header + 右下角 FAB:
 * - 标题 + kanocifer slug
 * - 右侧 AI 分析按钮 (替代右下 FAB,统一浮层入口)
 */

defineProps<{
  analysisOpen: boolean;
  analysisHasData: boolean;
}>();

defineEmits<{
  'toggle-analysis': [];
  'add-spot': [];
}>();
</script>

<template>
  <header class="bg-page/80 border-border top-0 z-30 border-b backdrop-blur-sm">
    <div
      class="mx-auto flex max-w-screen-2xl items-center justify-between px-4 py-3 sm:px-6"
    >
      <div class="flex items-baseline gap-3">
        <h1 class="text-ink text-wrap-balance font-serif text-xl">钓鱼地图</h1>
        <span class="text-muted font-serif text-xs tracking-[0.2em] italic">
          ka·no·ci·fer
        </span>
      </div>

      <div class="flex items-center gap-2">
        <Button size="md" @click="$emit('add-spot')">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
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
  </header>
</template>
