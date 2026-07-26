<template>
  <!-- 页脚：文学手账卷末 · 单行 -->
  <footer
    class="transition-colors duration-1000"
    :class="
      !isEntryView
        ? 'border-border border-t bg-white dark:bg-black'
        : 'border-0'
    "
  >
    <div
      class="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-x-5 gap-y-1.5 px-6 py-2.5 text-[11px] text-white mix-blend-difference"
    >
      <!-- 左：站名 + 版权章回标 -->
      <div class="flex items-baseline gap-2.5">
        <span class="font-serif text-[13px] italic">ka·no·ci·fer</span>
        <span aria-hidden="true" class="text-border/50">·</span>
        <span class="font-mono text-[10px] tracking-[0.2em] uppercase"
          >©2026</span
        >
      </div>

      <!-- 右：链接组 -->
      <div class="flex items-center gap-3">
        <a
          href="https://github.com/KanoCifer/Flask-Example"
          target="_blank"
          rel="noopener"
          class="hover:text-ink inline-flex items-center gap-1.5 transition-colors"
        >
          <img
            src="https://github.githubassets.com/favicons/favicon.svg"
            class="h-3.5 w-3.5 opacity-60 mix-blend-normal grayscale"
            alt="Github"
          />
          <span class="font-mono tracking-[0.1em]">GitHub</span>
        </a>
        <span aria-hidden="true" class="text-border/50">·</span>
        <a
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noopener"
          class="hover:text-ink font-mono transition-colors"
          >粤ICP备2026018113号</a
        >
        <span aria-hidden="true" class="text-border/50">·</span>
        <router-link to="/privacy" class="hover:text-ink transition-colors">
          <span class="font-mono tracking-[0.1em]">隐私政策</span>
        </router-link>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
defineProps<{
  isEntryView: boolean;
}>();
</script>
