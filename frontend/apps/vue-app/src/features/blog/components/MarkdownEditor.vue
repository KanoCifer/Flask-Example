<script setup lang="ts">
import ArticlePreview from './ArticlePreview.vue';
import ImageEditorModal from './ImageEditorModal.vue';
import { useMarkdownImage } from '@/features/upload/composables';
import 'highlight.js/styles/github-dark.css';
import { Modal } from '@/components';
import { renderMarkdown } from '@/composables';
import TurndownService from 'turndown';
import { computed, nextTick, ref, watch } from 'vue';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const props = defineProps<{
  modelValue?: string;
  /** 文章 ID（预览用，刊号带上的 No. 后缀） */
  postId?: string;
  /** 文章标题（预览用，未填时显示"无标题"） */
  title?: string;
  /** 文章封面 URL（预览用） */
  cover?: string;
  /** 文章作者（预览用） */
  author?: string;
  /** 标签（预览用，首项作为 kicker） */
  tags?: string[];
  /** 发布/创建时间（预览用） */
  createdAt?: string;
  /** 更新时间（预览用） */
  updatedAt?: string;
}>();

// 检测字符串是否像 HTML
const isHtmlLike = (str: string): boolean => {
  if (!str) return false;
  return (
    /<\/?[a-z][\s\S]*>/i.test(str) ||
    str.includes('&lt;') ||
    str.includes('&gt;')
  );
};

const markdownText = ref<string>(
  isHtmlLike(props.modelValue || '')
    ? turndownService.turndown(props.modelValue || '')
    : props.modelValue || '',
);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

// Image management (extracted to composable)
const image = useMarkdownImage();
const {
  fileInputRef,
  isImageEditorOpen,
  editingImageUrl,
  editingImageAlt,
  editingImageTitle,
  editingImageWidth,
  editingImageHeight,
  editingImageAlign,
} = image;

// 拖拽状态
const dragCounter = ref(0);
const isDraggingOver = ref(false);

const showPreview = ref(false);

// 切换预览
const togglePreview = () => {
  showPreview.value = !showPreview.value;
};

// 在光标处插入文本
const insertAtCursor = (before: string, after: string = '') => {
  const textarea = textareaRef.value;
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = markdownText.value.slice(start, end);

  const newText =
    markdownText.value.slice(0, start) +
    before +
    selectedText +
    after +
    markdownText.value.slice(end);
  markdownText.value = newText;

  nextTick(() => {
    const newCursorPos = start + before.length + selectedText.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    textarea.focus();
  });
};

// Markdown 快捷工具
const wrapBold = () => insertAtCursor('**', '**');
const wrapItalic = () => insertAtCursor('*', '*');
const wrapCode = () => insertAtCursor('`', '`');
const insertLink = () => insertAtCursor('[', '](url)');
const insertHeading = () => insertAtCursor('## ', '');
const insertList = () => insertAtCursor('- ', '');
const insertQuote = () => insertAtCursor('> ', '');

// 键盘快捷键
const handleKeydown = (e: KeyboardEvent) => {
  if (e.metaKey || e.ctrlKey) {
    switch (e.key.toLowerCase()) {
      case 'b':
        e.preventDefault();
        wrapBold();
        break;
      case 'i':
        e.preventDefault();
        wrapItalic();
        break;
      case 'k':
        e.preventDefault();
        insertLink();
        break;
      case 'p':
        if (e.shiftKey) {
          e.preventDefault();
          togglePreview();
        }
        break;
      case 's':
        e.preventDefault();
        emit('update:modelValue', markdownText.value);
        break;
    }
  }
};

// Watch for external changes (e.g., parent switches article being edited)
watch(
  () => props.modelValue,
  (newValue) => {
    const converted = isHtmlLike(newValue || '')
      ? turndownService.turndown(newValue || '')
      : newValue || '';
    if (converted !== markdownText.value) {
      markdownText.value = converted;
    }
  },
);

// Update parent when content changes
watch(markdownText, (newValue) => {
  emit('update:modelValue', newValue);
});

// Bridge functions: composable returns Markdown, editor inserts at cursor
const handleImageUpload = (event: Event) => {
  const md = image.handleImageUpload(event);
  if (md) insertAtCursor(md, '\n\n');
};

const handleDrop = (event: DragEvent) => {
  isDraggingOver.value = false;
  dragCounter.value = 0;
  const results = image.handleDrop(event);
  for (const md of results) {
    insertAtCursor(md, '\n\n');
  }
};

const handlePaste = (event: ClipboardEvent) => {
  const results = image.handlePaste(event);
  for (const md of results) {
    insertAtCursor(md, '\n\n');
  }
};

const renderedMarkdown = computed<string>(() => {
  if (!markdownText.value) return '';
  return renderMarkdown(markdownText.value, {
    ADD_ATTR: ['data-md-id', 'data-align'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|blob):|[^a-z]*|[a-z0-9.+-]*$)/i,
  });
});

// 阅读统计（详情页风预览需要展示"X 分钟 · Y 字"）
// 复用 BlogEditorView 的 CJK 词数计算口径，避免预览与发布后阅读时长不一致
const stats = computed<{ minutes: number; count: number }>(() => {
  const text = markdownText.value;
  if (!text) return { minutes: 1, count: 0 };
  const stripped = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/^#+\s+/gm, '')
    .replace(/[*_>~-]+/g, ' ');
  const cjk = (stripped.match(/[一-鿿㐀-䶿]/g) || []).length;
  const words = (
    stripped.replace(/[一-鿿㐀-䶿]/g, ' ').match(/[A-Za-z0-9]+/g) || []
  ).length;
  const count = cjk + words;
  const minutes = Math.max(1, Math.round(count / 400));
  return { minutes, count };
});

// 暴露给父组件：发布时上传所有 blob 图片并返回最终内容
defineExpose({
  getContentForPublish: () => image.getContentForPublish(markdownText.value),
});
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Editor -->
    <div
      class="relative flex h-full w-full flex-col"
      @dragover.prevent="dragCounter++"
      @dragleave.prevent="
        dragCounter--;
        isDraggingOver = dragCounter > 0;
      "
      @drop.prevent="handleDrop"
    >
      <!-- Drag overlay -->
      <div
        v-if="isDraggingOver"
        class="border-accent/50 bg-accent/10 pointer-events-none absolute inset-0 z-10 flex items-center justify-center border-2 border-dashed"
      >
        <span class="text-ink text-sm font-semibold">释放以添加图片</span>
      </div>

      <!-- Toolbar -->
      <div
        class="border-border flex h-10 shrink-0 items-center justify-between border-b px-4"
      >
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="text-muted hover:bg-surface/50 hover:text-ink rounded-lg px-2 py-1.5 text-sm font-medium transition"
            @click="wrapBold"
            title="粗体 (Cmd+B)"
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            class="text-muted hover:bg-surface/50 hover:text-ink rounded-lg px-2 py-1.5 text-sm font-medium italic transition"
            @click="wrapItalic"
            title="斜体 (Cmd+I)"
          >
            I
          </button>
          <div class="bg-border mx-1 h-4 w-px"></div>
          <button
            type="button"
            class="text-muted hover:bg-surface/50 hover:text-ink rounded-lg px-2 py-1.5 text-sm font-medium transition"
            @click="insertHeading"
            title="标题 (##)"
          >
            H2
          </button>
          <button
            type="button"
            class="text-muted hover:bg-surface/50 hover:text-ink rounded-lg px-2 py-1.5 text-sm font-medium transition"
            @click="insertQuote"
            title="引用 (> )"
          >
            <span class="opacity-70">"</span>
          </button>
          <button
            type="button"
            class="text-muted hover:bg-surface/50 hover:text-ink rounded-lg px-2 py-1.5 text-sm font-medium transition"
            @click="insertList"
            title="列表 (- )"
          >
            <span class="opacity-70">—</span>
          </button>
          <button
            type="button"
            class="text-muted hover:bg-surface/50 hover:text-ink rounded-lg px-2 py-1.5 text-sm font-medium transition"
            @click="wrapCode"
            title="行内代码"
          >
            &lt;/&gt;
          </button>
          <button
            type="button"
            class="text-muted hover:bg-surface/50 hover:text-ink rounded-lg px-2 py-1.5 text-sm font-medium transition"
            @click="insertLink"
            title="链接 (Cmd+K)"
          >
            <span class="opacity-70">🔗</span>
          </button>
          <div class="bg-border mx-1 h-4 w-px"></div>
          <input
            ref="fileInputRef"
            type="file"
            accept="image/*"
            class="hidden"
            @change="handleImageUpload"
          />
          <button
            type="button"
            class="text-muted hover:bg-surface/50 hover:text-ink rounded-lg px-2 py-1.5 text-sm font-medium transition"
            @click="fileInputRef?.click()"
            title="插入图片"
          >
            <span class="opacity-70">🖼</span>
          </button>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            :class="[
              'rounded-lg px-3 py-1.5 text-xs font-medium transition',
              showPreview
                ? 'bg-accent/10 text-ink'
                : 'text-muted hover:bg-surface/50 hover:text-ink',
            ]"
            @click="togglePreview"
            title="预览 (Cmd+Shift+P)"
          >
            预览
          </button>
        </div>
      </div>

      <div class="relative h-full flex-1">
        <textarea
          ref="textareaRef"
          v-model="markdownText"
          @keydown="handleKeydown"
          @paste="handlePaste"
          :class="[
            'text-ink placeholder:text-muted/60 bg-surface field-sizing-content h-full min-h-80 w-full resize-none outline-none focus:ring-0',
            'px-8 py-6 text-lg leading-relaxed',
            'font-serif',
          ]"
          placeholder="开始写作..."
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
        ></textarea>
      </div>
    </div>

    <!-- Preview Modal -->
    <Modal
      :open="showPreview"
      size="2xl"
      :mask-closable="true"
      :esc-closable="true"
      @close="togglePreview"
    >
      <div class="flex h-[min(85vh,920px)] flex-col">
        <div class="flex shrink-0 items-center justify-between border-b px-6 py-3">
          <h2 class="text-muted text-xs font-medium tracking-wide">预览</h2>
          <button
            type="button"
            class="text-muted hover:text-ink rounded-full px-3 py-1 text-xs font-semibold transition hover:bg-surface"
            @click="togglePreview"
          >
            关闭
          </button>
        </div>
        <div class="flex-1 overflow-y-auto contain-[layout_paint_scroll_style] bg-page">
          <ArticlePreview
            :post-id="postId"
            :title="title || '无标题'"
            :cover="cover || null"
            :author="author"
            :tags="tags"
            :created-at="createdAt"
            :updated-at="updatedAt"
            :minutes="stats.minutes"
            :word-count="stats.count"
            :body-html="renderedMarkdown"
            :show-ai-card="false"
            @image-click="image.openImageEditor"
          />
        </div>
      </div>
    </Modal>

    <!-- Image Editor Modal -->
    <ImageEditorModal
      :is-open="isImageEditorOpen"
      :image-url="editingImageUrl"
      :alt="editingImageAlt"
      :title="editingImageTitle"
      :width="editingImageWidth"
      :height="editingImageHeight"
      :align="editingImageAlign"
      @close="image.closeImageEditor()"
      @update:alt="(v) => (editingImageAlt = v)"
      @update:title="(v) => (editingImageTitle = v)"
      @update:width="(v) => (editingImageWidth = v)"
      @update:height="(v) => (editingImageHeight = v)"
      @update:align="(v) => (editingImageAlign = v)"
      @replace-image="(e) => image.handleReplaceImageUpload(e)"
      @open-new-tab="(url) => image.openImageInNewTab(url)"
    />
  </div>
</template>
