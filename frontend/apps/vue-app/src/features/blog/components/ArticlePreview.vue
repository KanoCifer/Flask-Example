<script setup lang="ts">
/**
 * ArticlePreview · 文章阅读视图（详情页 / 编辑器预览 共享）
 *
 * 从 BlogPostView 抽出"读者看到的版面"：
 *   封面 → 刊号带 → kicker → 大标题 → deck → byline → 正文 → 署名/复制链接
 *
 * 编辑器 (MarkdownEditor) 与详情页 (BlogPostView) 都复用同一份版面，
 * 写完看到的预览 = 发布后读者看到的页面。
 *
 * 不在此处渲染：点赞/浏览量、AI 摘要、评论、阅读进度条、删除弹窗 —
 * 这些是详情页独有的。
 *
 * Slots:
 *   - header-actions: 标题右侧的操作（编辑/删除）
 *   - deck-extras: deck 行尾部的扩展（浏览量/点赞等）
 *   - footer-extra: 署名块之后的扩展（复制链接）
 *
 * Events:
 *   - image-click: 正文中的 <img> 被点击（编辑器用来打开图片编辑器）
 *   - copy-link: footer 上的"复制链接"被点击
 */
import { formatDate } from '@/lib/dayjs';
import { useOrigin } from '@readinglist/utils';
import { computed } from 'vue';

const props = defineProps<{
  /** 文章 ID（用于刊号带上的 No. 后缀） */
  postId?: string;
  /** 标题 */
  title: string;
  /** 封面 URL，留空不渲染封面区 */
  cover?: string | null;
  /** 作者署名 */
  author?: string;
  /** 标签（kicker 取首个） */
  tags?: string[];
  /** 发布时间 */
  createdAt?: string;
  /** 更新时间 */
  updatedAt?: string;
  /** 阅读时长（分钟） */
  minutes?: number;
  /** 字数 */
  wordCount?: number;
  /** 已经过 markdown → sanitize 处理的 HTML 字符串 */
  bodyHtml?: string;
  /**
   * 视图密度：
   *   - 'detail' (默认): 完整 editorial chrome（详情页风格）
   *   - 'compact': 去掉刊号带/kicker/署名 footer，适合编辑器侧栏（半宽空间）
   */
  variant?: 'detail' | 'compact';
}>();

const emit = defineEmits<{
  'image-click': [img: HTMLImageElement];
  'copy-link': [];
}>();

// 非 http(s) 开头的 src 用 https://api.kanocifer.chat 作为前缀（仅 https 生效）
const coverSrc = computed(() => (props.cover ? useOrigin(props.cover) : ''));

// 更新时间仅在与创建时间不同时才展示，避免噪音
const hasUpdate = computed(
  () =>
    !!props.updatedAt &&
    !!props.createdAt &&
    props.updatedAt !== props.createdAt,
);

// 第一篇标签作为 kicker；空时回退到「未分类」
const primaryTag = computed(() => props.tags?.[0] || '未分类');

// 仅在编辑器预览里关闭"刊号带 + kicker + 署名 footer"等装饰，避免窄栏拥挤
const isCompact = computed(() => props.variant === 'compact');

// 正文中的 <img> 点击事件透传给父组件（编辑器用来打开图片编辑器）
const onBodyClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null;
  if (!target || target.tagName !== 'IMG') return;
  emit('image-click', target as HTMLImageElement);
};
</script>

<template>
  <article class="mx-auto max-w-4xl px-6 pt-10 pb-14">
    <!-- 封面置顶：主视觉先行 -->
    <figure v-if="coverSrc" class="mb-10 overflow-hidden rounded-xl">
      <div class="bg-surface aspect-[16/9] w-full overflow-hidden">
        <img
          :src="coverSrc"
          :alt="`${title} 封面`"
          class="h-full w-full object-cover"
          loading="lazy"
          style="
            box-shadow: inset 0 0 0 1px oklch(from var(--ink) l c h / 0.08);
          "
        />
      </div>
      <figcaption class="text-muted mt-2.5 text-[11px] tracking-[0.04em]">
        封面 · {{ primaryTag }}
      </figcaption>
    </figure>

    <!-- 文章头 -->
    <header class="my-10">
      <!-- 刊号式元信息带：出版物气质，mono 大字距（compact 模式省略） -->
      <div
        v-if="!isCompact"
        class="text-muted mb-6 flex items-center justify-between border-b pb-3 font-mono text-[10px] tracking-[0.18em] uppercase"
      >
        <span>Vol · 随笔录</span>
        <span class="text-muted/70">No · {{ postId?.slice(-6) || '——' }}</span>
      </div>

      <!-- Eyebrow / kicker — accent 唯一一次正式出场（compact 模式省略） -->
      <div
        v-if="!isCompact"
        class="text-ink mb-5 flex items-center gap-2 text-[11px] font-semibold tracking-[0.14em] uppercase"
      >
        <span class="bg-accent h-px w-5"></span>
        {{ primaryTag }}
      </div>

      <!-- 大标题 -->
      <h1
        class="text-ink flex items-center justify-between gap-2 font-serif text-[clamp(1.875rem,5vw,2.5rem)] leading-[1.18] font-medium tracking-[-0.02em] text-balance"
      >
        <span>{{ title || '无标题' }}</span>

        <!-- 标题右侧的操作（编辑/删除，仅详情页用） -->
        <slot name="header-actions" />
      </h1>

      <!-- Deck: 阅读时长 + 字数 + 扩展（浏览量/点赞，仅详情页用） -->
      <p
        class="text-muted mt-5 text-[15px] leading-relaxed tracking-[0.01em] tabular-nums"
      >
        <template v-if="minutes != null">
          约 {{ minutes }} 分钟阅读 ·
          {{ (wordCount ?? 0).toLocaleString() }} 字
        </template>
        <slot name="deck-extras" />
      </p>

      <!-- Byline / dateline -->
      <div
        class="text-muted mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] tracking-[0.02em]"
      >
        <span v-if="author" class="text-ink/80 font-medium">
          {{ author }}
        </span>
        <span v-if="author && createdAt" class="bg-border h-3 w-px"></span>
        <time v-if="createdAt" :datetime="createdAt">
          {{ formatDate(createdAt) }}
        </time>
        <template v-if="hasUpdate">
          <span class="bg-border h-3 w-px"></span>
          <span>更新于 {{ formatDate(updatedAt) }}</span>
        </template>
      </div>
    </header>

    <!-- 正文 -->
    <div class="prose prose-lg max-w-none">
      <div
        class="prose-body whitespace-pre-wrap"
        :class="isCompact ? 'prose-body--compact' : null"
        v-if="bodyHtml"
        v-html="bodyHtml"
        @click="onBodyClick"
      />
      <div v-else class="text-muted italic">暂无内容</div>
    </div>

    <!-- 文章脚：作者署名块 + 复制链接（compact 模式省略署名块） -->
    <footer v-if="!isCompact" class="mt-14 pt-8">
      <div class="flex flex-wrap items-start justify-between gap-5">
        <div class="flex items-center gap-3.5">
          <img
            src="/images/animal-badge/fox.png"
            :alt="author || 'Kurroome'"
            class="ring-border h-11 w-11 shrink-0 rounded-full object-cover ring-1"
            loading="lazy"
          />
          <div class="min-w-0">
            <div class="text-ink text-[14px] font-medium tracking-wide">
              {{ author || 'Kurroome' }}
            </div>
            <div class="text-muted mt-0.5 text-[12px] tracking-[0.02em]">
              {{
                hasUpdate
                  ? `最后更新于 ${formatDate(updatedAt)}`
                  : createdAt
                    ? `发布于 ${formatDate(createdAt)}`
                    : ''
              }}
            </div>
          </div>
        </div>

        <!-- footer 扩展（详情页放"复制链接"按钮） -->
        <slot
          name="footer-extra"
          :copy-link="() => emit('copy-link')"
        />
      </div>
    </footer>
  </article>
</template>

<style scoped>
/* Compact 模式：在编辑器半宽侧栏里缩小节奏，避免正文首段 drop-cap 撑爆版面 */
.prose-body--compact > p:first-of-type::first-letter {
  float: none;
  font-size: 1em;
  font-weight: inherit;
  margin: 0;
  color: inherit;
}
</style>