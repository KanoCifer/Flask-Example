<template>
  <motion.article
    :initial="{ opacity: 0, y: 16 }"
    :whileInView="WHILE_IN_VIEW_FADE_UP"
    :viewport="{ once: true, margin: '-40px' }"
    :transition="{ type: 'spring', stiffness: 280, damping: 24 }"
    class="relative"
  >
    <div
      role="button"
      tabindex="0"
      :class="[
        'group relative block cursor-pointer overflow-hidden rounded-2xl border px-5 py-5 shadow-sm transition-all duration-300 ease-out focus-visible:outline-none',
        'hover:-translate-y-0.5 hover:shadow-md',
        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2',
        moment.is_pinned
          ? 'bg-warning/8 border-warning/30'
          : 'bg-card /40 hover:border-accent/25',
      ]"
      @click="emit('open', moment.id)"
      @keydown.enter.prevent="emit('open', moment.id)"
      @keydown.space.prevent="emit('open', moment.id)"
    >
      <!-- 左侧撕纸虚线 -->
      <div
        aria-hidden="true"
        class="border-warning/40 absolute top-3 bottom-3 left-2 border-l border-dashed"
      />

      <!-- 置顶别针徽章 -->
      <span
        v-if="moment.is_pinned"
        class="bg-warning/15 text-warning absolute -top-2 left-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.18em] uppercase shadow-sm"
      >
        <Star class="h-3 w-3" />
        <span>置顶</span>
      </span>

      <!-- admin 浮动操作（hover 出现，避免抢戏） -->
      <div
        v-if="isAdmin"
        class="absolute top-2 right-2 flex items-center gap-1 opacity-0 transition-opacity duration-200 group-focus-within:opacity-100 group-hover:opacity-100"
        @click.stop
      >
        <Button
          variant="ghost"
          size="icon"
          class="bg-page/95 /40 hover:!bg-page !h-7 !w-7 border"
          :aria-label="`编辑 ${moment.id}`"
          @click="emit('edit', moment)"
        >
          <Pencil class="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          class="bg-page/95 /40 hover:!text-destructive !h-7 !w-7 border"
          :aria-label="`删除 ${moment.id}`"
          @click="emit('delete', moment)"
        >
          <Trash2 class="h-3.5 w-3.5" />
        </Button>
      </div>

      <!-- 元数据行 -->
      <MomentMeta
        :moment="moment"
        :volume-label="volumeLabel"
        class="relative pl-3"
      />

      <!-- 内容预览（markdown 渲染，自带 prose 主题） -->
      <div
        class="prose prose-sm text-ink moment-clamp-3 relative mt-2 max-w-none pl-3 font-serif!"
        v-html="withDropCap(renderMarkdown(moment.content))"
      />

      <!-- 标签 chip 行 -->
      <div
        v-if="moment.tags.length"
        class="text-muted relative mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 pl-3 text-[11px]"
        @click.stop
      >
        <MomentTagChip v-for="tag in moment.tags" :key="tag" :name="tag" />
      </div>
    </div>
  </motion.article>
</template>

<script setup lang="ts">
import { Button } from '@/components';
import { Pencil, Star, Trash2 } from '@lucide/vue';
import { renderMarkdown } from '@/composables';
import type { Moment } from '@/features/moments/types';
import { motion } from 'motion-v';
import { WHILE_IN_VIEW_FADE_UP } from '@/constants';
import MomentMeta from './MomentMeta.vue';
import MomentTagChip from './MomentTagChip.vue';

defineProps<{
  moment: Moment;
  /** 卷序号，例如 "卷十二"；可选 */
  volumeLabel?: string;
  isAdmin?: boolean;
}>();

const emit = defineEmits<{
  (e: 'open', id: string): void;
  (e: 'edit', moment: Moment): void;
  (e: 'delete', moment: Moment): void;
}>();

/**
 * 把首字包到 <span class="drop-cap">，让 CSS 可以用真实 DOM 元素放大首字。
 * ::first-letter 在 display:-webkit-box（line-clamp 容器）内对 CJK 字符不稳定，
 * 且 display:inline-block 在伪元素上被规范禁止，改用注入的 span 稳定可控。
 */
function withDropCap(html: string): string {
  if (!html) return html;
  return html.replace(
    /^(<p[^>]*>)([^\s])/,
    '$1<span class="drop-cap">$2</span>',
  );
}
</script>

<style lang="scss" scoped>
// 不使用 Tailwind 的 .line-clamp-3：它会把容器变成 display:-webkit-box，
// 首字样式（包括 ::first-letter 和 inline-block span）都会被 box layout 影响。
// 改用现代 line-clamp 简写，容器保持普通 block，<p> 是 block container。
.moment-clamp-3 {
  line-clamp: 3;
  overflow: hidden;
  text-wrap: pretty;
}

// 真实 DOM 元素，::v-deep 跨过 v-html 边界命中由 withDropCap 注入的 span。
// font / line-height / vertical-align 在 inline-block 上都稳定生效。
:deep(.drop-cap) {
  display: inline-block;
  font-size: 3rem;
  font-weight: bold;
  line-height: 0.9;
  margin-right: 0.12em;
  vertical-align: top;
  color: var(--accent);
}
</style>
