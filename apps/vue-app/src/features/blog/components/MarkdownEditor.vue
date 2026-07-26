<script setup lang="ts">
import ImageEditorModal from './ImageEditorModal.vue';
import { useMarkdownImage } from '@/features/upload/composables';
import hljs from 'highlight.js/lib/common';
import 'highlight.js/styles/github-dark.css';
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

const isFocusMode = ref(false);
const showPreview = ref(false);

// 切换聚焦模式
const toggleFocusMode = () => {
  isFocusMode.value = !isFocusMode.value;
};

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
      case 'f':
        if (e.shiftKey) {
          e.preventDefault();
          toggleFocusMode();
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

const handlePreviewClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null;
  if (!target || target.tagName !== 'IMG') return;
  image.openImageEditor(target as HTMLImageElement);
};

const renderedMarkdown = computed<string>(() => {
  if (!markdownText.value) return '';
  return renderMarkdown(markdownText.value, {
    ADD_ATTR: ['data-md-id', 'data-align'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|blob):|[^a-z]*|[a-z0-9.+-]*$)/i,
  });
});

// Apply syntax highlighting after Vue renders the preview HTML
watch(renderedMarkdown, () => {
  nextTick(() => {
    document.querySelectorAll('.prose pre code').forEach((block) => {
      hljs.highlightElement(block as HTMLElement);
    });
  });
});

// 暴露给父组件：发布时上传所有 blob 图片并返回最终内容
defineExpose({
  getContentForPublish: () => image.getContentForPublish(markdownText.value),
});
</script>

<template>
  <div class="flex h-full flex-col md:flex-row">
    <!-- Editor -->
    <div
      :class="[
        'relative flex h-full flex-col transition-all duration-300',
        showPreview ? 'md:w-1/2 md:border-r md:pr-4' : 'w-full',
      ]"
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
        class="/50 flex h-10 shrink-0 items-center justify-between border-b px-4"
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
              isFocusMode
                ? 'bg-warning/10 text-warning'
                : 'text-muted hover:bg-surface/50 hover:text-ink',
            ]"
            @click="toggleFocusMode"
            title="聚焦模式 (Cmd+Shift+F)"
          >
            {{ isFocusMode ? '聚焦中' : '聚焦' }}
          </button>
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
        <!-- Focus mode dimming overlay -->
        <div
          v-if="isFocusMode"
          class="from-page/90 pointer-events-none absolute inset-x-0 top-0 z-10 h-1/4 bg-gradient-to-b to-transparent"
        ></div>

        <textarea
          ref="textareaRef"
          v-model="markdownText"
          @keydown="handleKeydown"
          @paste="handlePaste"
          :class="[
            'placeholder:text-muted/60 bg-surface field-sizing-content h-full min-h-80 w-full outline-none focus:ring-0',
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

    <!-- Preview Panel (Slide-in) -->
    <transition
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0 w-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-all duration-200 ease-out"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0 w-0"
    >
      <div v-if="showPreview" class="/50 bg-page/50 border-l md:w-1/2 md:pl-4">
        <div class="flex h-full flex-col">
          <div class="flex h-10 shrink-0 items-center justify-between px-4">
            <h2 class="text-muted text-xs font-medium">预览</h2>
            <button
              type="button"
              class="text-muted hover:text-ink text-xs transition"
              @click="togglePreview"
            >
              关闭
            </button>
          </div>
          <div class="prose max-w-none flex-1 overflow-y-auto px-6 py-4">
            <div v-html="renderedMarkdown" @click="handlePreviewClick"></div>
          </div>
        </div>
      </div>
    </transition>

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
