<script setup lang="ts">
import MarkdownEditor from './components/MarkdownEditor.vue';
import { Button as UiButton, IconSave } from '@/components';
import { blogGateway } from '@/features/blog/api/blogGateway';
import { useOrigin } from '@/composables';
import { useUpload } from '@/features/upload/composables';
import { useNotificationStore } from '@/stores';
import { ModalFadeTransition } from '@/components';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();
const notification = useNotificationStore();

// Post state
const isEdit = ref(false);
const postId = ref<string | null>(null);
const title = ref('');
const summary = ref('');
const cover = ref('');
const tags = ref<string[]>([]);
const tagInput = ref('');
const pin = ref(false);
const loading = ref(false);
const coverInputRef = ref<HTMLInputElement | null>(null);
const error = ref('');

// 封面上传：统一 useUpload 原语，保留 spinner + toast 行为
const { upload: uploadCover, isUploading: coverUploading } = useUpload({
  type: 'blog',
});

// Markdown state
const markdownBody = ref('');
const markdownEditorRef = ref<InstanceType<typeof MarkdownEditor> | null>(null);

// Meta drawer (summary + cover): collapsed by default — the writing canvas
// is the focal point, metadata is peek-on-demand.
const metaOpen = ref(false);

// 非 http(s) 开头的封面 src 用 https://api.kanocifer.chat 作为前缀（仅在 https 环境下生效）
const coverPreviewSrc = computed(() =>
  cover.value ? useOrigin(cover.value) : '',
);

// Draft management
const draftKey = computed(() => `blog-draft-${postId.value || 'new'}`);
const lastSavedAt = ref<Date | null>(null);
const hasUnsavedChanges = ref(false);
const autoSaveEnabled = ref(true);

// Tag input handling
const addTag = (raw: string) => {
  const value = raw.trim();
  if (value && !tags.value.includes(value)) {
    tags.value.push(value.slice(0, 50));
  }
  tagInput.value = '';
};

const removeTag = (tag: string) => {
  tags.value = tags.value.filter((t) => t !== tag);
};

const handleTagKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault();
    if (tagInput.value.trim()) {
      addTag(tagInput.value);
    }
  } else if (
    event.key === 'Backspace' &&
    !tagInput.value &&
    tags.value.length
  ) {
    tags.value.pop();
  }
};

// Auto-save with debounce
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
const saveDraft = () => {
  const draft = {
    title: title.value,
    summary: summary.value,
    cover: cover.value,
    markdownBody: markdownBody.value,
    tags: tags.value,
    pin: pin.value,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(draftKey.value, JSON.stringify(draft));
  lastSavedAt.value = new Date();
  hasUnsavedChanges.value = false;
};

// Watch changes and trigger auto-save
watch(
  [title, summary, cover, markdownBody, tags, pin],
  () => {
    hasUnsavedChanges.value = true;
    if (autoSaveEnabled.value) {
      if (autoSaveTimer) clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(saveDraft, 3000);
    }
  },
  { deep: true },
);

// Restore draft from localStorage
const restoreDraft = (): boolean => {
  const saved = localStorage.getItem(draftKey.value);
  if (!saved) return false;
  try {
    const draft = JSON.parse(saved);
    title.value = draft.title || '';
    summary.value = draft.summary || '';
    cover.value = draft.cover || '';
    markdownBody.value = draft.markdownBody || '';
    tags.value = Array.isArray(draft.tags) ? draft.tags : [];
    pin.value = draft.pin || false;
    if (draft.savedAt) lastSavedAt.value = new Date(draft.savedAt);
    return true;
  } catch {
    return false;
  }
};

// Clear draft after successful publish
const clearDraft = () => {
  localStorage.removeItem(draftKey.value);
  lastSavedAt.value = null;
};

// Check if draft exists
const hasDraft = computed(() => !!localStorage.getItem(draftKey.value));
const showDraftRestore = ref(false);

// Prevent closing with unsaved changes
const handleBeforeUnload = (e: BeforeUnloadEvent) => {
  if (hasUnsavedChanges.value) {
    e.preventDefault();
    e.returnValue = '';
  }
};

// Get current markdown content (stored as-is, no HTML conversion)
const getCurrentContent = (): string => {
  return markdownBody.value;
};

const handleCoverUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  try {
    cover.value = await uploadCover(file);
    notification.success('封面上传成功');
  } catch (err) {
    console.error(err);
    notification.error('封面上传失败');
  } finally {
    target.value = '';
  }
};

// Manual save draft (Cmd+S)
const handleSaveDraft = () => {
  saveDraft();
  notification.success('草稿已保存');
};

// Keyboard shortcut for save
const handleKeydown = (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    handleSaveDraft();
  }
};

// Fetch existing post
const fetchPost = async (id: string) => {
  loading.value = true;
  try {
    const post = await blogGateway.getLegacyPost(id);
    title.value = post.title || '';
    summary.value = post.summary || '';
    cover.value = post.cover || '';
    tags.value = Array.isArray(post.tags) ? post.tags : [];
    pin.value = Boolean(post.is_pinned);

    // Load content — stored as raw markdown
    markdownBody.value = post.body || '';

    // Auto-open meta drawer if cover or summary is set on an existing post
    if (post.summary || post.cover) metaOpen.value = true;
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : '加载文章失败';
    notification.error(error.value);
    console.error(err);
  } finally {
    loading.value = false;
  }
};

// Form ref for DOM check
const formRef = ref<HTMLElement | null>(null);

// Submit handler
const handleSubmit = async () => {
  if (!formRef.value || !document.body.contains(formRef.value)) {
    console.warn('Form submission canceled because the form is not connected');
    return;
  }

  if (!title.value.trim()) {
    error.value = '标题不能为空';
    notification.error(error.value);
    return;
  }

  // Get content and upload images
  let currentContent: string;
  if (markdownEditorRef.value) {
    try {
      // Upload all blob images and get markdown content with server URLs
      // Store raw markdown — conversion to HTML happens at display time
      currentContent = await markdownEditorRef.value.getContentForPublish();
    } catch (err) {
      error.value = '图片上传失败';
      notification.error(error.value);
      console.error(err);
      return;
    }
  } else {
    currentContent = getCurrentContent();
  }

  if (!currentContent.trim()) {
    error.value = '内容不能为空';
    notification.error(error.value);
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    const payload = {
      title: title.value,
      body: currentContent,
      summary: summary.value,
      cover: cover.value.trim() || null,
      tags: tags.value,
      is_pinned: pin.value ? 1 : 0,
    };

    if (isEdit.value && postId.value) {
      const updatePayload = { ...payload, _id: postId.value };
      await blogGateway.updateLegacyPost(updatePayload);
      notification.success('文章更新成功');
    } else {
      await blogGateway.createLegacyPost(payload);
      notification.success('文章发布成功');
    }

    clearDraft();
    router.back();
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : '保存文章失败';
    notification.error(error.value);
    console.error(err);
  } finally {
    loading.value = false;
  }
};

const handleCancel = () => {
  router.back();
};

const discardDraftAndLoadServer = async () => {
  showDraftRestore.value = false;
  if (postId.value) await fetchPost(postId.value);
};

const adoptDraft = () => {
  restoreDraft();
  showDraftRestore.value = false;
  notification.success('已恢复草稿');
};

// Word count for the footer indicator
const wordCount = computed(() => {
  const text = markdownBody.value.trim();
  if (!text) return 0;
  // Strip markdown syntax noise: code fences, image/link syntax, headings
  const stripped = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/^#+\s+/gm, '')
    .replace(/[*_>~-]+/g, ' ');
  // CJK-aware count: each CJK char = 1, run of non-CJK = 1 word
  const cjkChars = (stripped.match(/[一-鿿㐀-䶿]/g) || []).length;
  const latinWords = (
    stripped.replace(/[一-鿿㐀-䶿]/g, ' ').match(/[A-Za-z0-9]+/g) || []
  ).length;
  return cjkChars + latinWords;
});

// Reading time, rounded up to a minute
const readingMinutes = computed(() =>
  Math.max(1, Math.round(wordCount.value / 400)),
);

// Status line: 准备就绪 / 已保存 X:X:X / 未保存更改
const savedAtLabel = computed(() => {
  if (hasUnsavedChanges.value) return '未保存的更改';
  if (lastSavedAt.value) {
    const t = lastSavedAt.value.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `草稿已存 · ${t}`;
  }
  return '准备就绪';
});

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown);
  window.addEventListener('beforeunload', handleBeforeUnload);

  const id = route.params.id;

  if (id && id !== 'new') {
    isEdit.value = true;
    postId.value = String(id);

    // Check for draft first
    if (hasDraft.value) {
      showDraftRestore.value = true;
    } else {
      await fetchPost(postId.value);
    }
  } else {
    // New post - try restore draft
    if (hasDraft.value && restoreDraft()) {
      showDraftRestore.value = false;
      notification.success('已恢复上次草稿');
    }
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
  window.removeEventListener('beforeunload', handleBeforeUnload);
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
});
</script>

<template>
  <!--
    写作台 · Writing desk
    一个工具页，不是详情页。BasicDetail 那种 hero 折纸壳子被剥离了 —
    标题就是输入框，编辑器就是主角，元数据折叠在抽屉里。

    视觉策略：
    · 页面底色 = bg-surface (warm-gray)，像书桌的木板
    · 编辑器在它之上浮起 = bg-surface (paper)，靠 inset highlight + 软阴影分层
    · 状态不用彩色 chip（bg-warning/10 等），改用单一字色 + 留白 + 描线
    · 所有动画 honor prefers-reduced-motion
  -->
  <div class="bg-page min-h-dvh">
    <div class="mx-auto w-full max-w-6xl px-5 pt-8 pb-28 sm:px-8 sm:pt-10">
      <!-- ─── Top bar: wordmark · breadcrumb · status ─── -->
      <header class="text-muted mb-7 flex items-center gap-3 text-xs">
        <button
          type="button"
          class="hover:text-ink -mx-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors"
          @click="$router.go(-1)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            class="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
              clip-rule="evenodd"
            />
          </svg>
          <span>书房</span>
        </button>

        <span aria-hidden="true" class="text-border">/</span>

        <span class="text-ink/80 font-serif">
          {{ isEdit ? '校样' : '新篇' }}
        </span>

        <span v-if="isEdit && postId" class="text-muted/60 font-mono">
          #{{ postId }}
        </span>

        <!-- Status: 单一字色，靠前缀"·"呼吸，不用 bg-pill 灯拼色 -->
        <span class="ml-auto font-serif tracking-wide italic">
          <span aria-hidden="true" class="mr-1.5">·</span>{{ savedAtLabel }}
        </span>
      </header>

      <!-- ─── Draft restore: 角落小吐司，不抢镜 ─── -->
      <div
        v-if="showDraftRestore"
        role="status"
        class="bg-surface mb-6 flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm"
      >
        <span
          class="text-muted ring-border inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1"
          aria-hidden="true"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            class="h-3.5 w-3.5"
          >
            <path
              d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z"
            />
          </svg>
        </span>
        <div class="min-w-0 flex-1 text-xs">
          <p class="text-ink font-serif">上次留有未完的草稿</p>
          <p class="text-muted mt-0.5">
            {{
              lastSavedAt
                ? `保存于 ${lastSavedAt.toLocaleString('zh-CN', { hour12: false })}`
                : '时间不明'
            }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-3 text-xs">
          <button
            type="button"
            class="text-muted hover:text-ink transition-colors"
            @click="discardDraftAndLoadServer"
          >
            放弃
          </button>
          <button
            type="button"
            class="text-ink hover:text-ink font-serif transition-colors"
            @click="adoptDraft"
          >
            续写 →
          </button>
        </div>
      </div>

      <!-- ─── Error: 内联短条 ─── -->
      <div
        v-if="error"
        role="alert"
        class="text-muted bg-surface/70 mb-6 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          class="text-muted mt-0.5 h-4 w-4 shrink-0"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clip-rule="evenodd"
          />
        </svg>
        <span class="font-serif italic">{{ error }}</span>
      </div>

      <!-- ─── Loading ─── -->
      <div v-if="loading && isEdit" class="py-20 text-center">
        <div
          class="border-t-ink mx-auto h-7 w-7 animate-spin rounded-full border-2 motion-reduce:animate-none"
          aria-hidden="true"
        ></div>
        <p class="text-muted mt-3 font-serif text-xs italic">正取文稿…</p>
      </div>

      <!-- ─── The writing form ─── -->
      <form
        v-else
        ref="formRef"
        @submit.prevent="handleSubmit"
        class="space-y-6"
      >
        <!-- 标题：作品门面，serif 大字，输入即设计 -->
        <div>
          <input
            v-model="title"
            type="text"
            required
            maxlength="120"
            :placeholder="isEdit ? '校订标题' : '无题'"
            aria-label="文章标题"
            class="text-ink placeholder:text-muted/50 w-full border-0 bg-transparent px-0 py-1 font-serif text-3xl leading-tight font-medium tracking-tight outline-0 focus:ring-0 sm:text-4xl"
            style="caret-color: var(--accent, currentColor)"
          />
          <div
            class="via-border mt-1 h-px bg-gradient-to-r from-transparent to-transparent"
            aria-hidden="true"
          ></div>
        </div>

        <!--
          标签 · 置顶 · 抽屉触发
          标签用 chips input：回车/逗号新增，退格删除最后一个，
          每个 tag 是独立的 chip 带 × 删除按钮。
        -->
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <!-- Tags input -->
          <div
            class="bg-surface flex flex-wrap items-center gap-1.5 rounded-full border px-2 py-1"
          >
            <span class="text-muted/70 tracking-wider">标签</span>
            <span
              v-for="tag in tags"
              :key="tag"
              class="bg-page text-ink inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
            >
              #{{ tag }}
              <button
                type="button"
                class="hover:text-destructive text-muted"
                :aria-label="`删除标签 ${tag}`"
                @click="removeTag(tag)"
              >
                ×
              </button>
            </span>
            <input
              v-model="tagInput"
              type="text"
              placeholder="回车新增…"
              class="text-ink placeholder:text-muted/50 min-w-[60px] flex-1 bg-transparent text-xs outline-none"
              @keydown="handleTagKeydown"
              @blur="
                () => {
                  if (tagInput.trim()) addTag(tagInput);
                }
              "
            />
          </div>

          <!-- Pin: 单一字色 + 字距表达"已置顶"，不再用 warning 色块 -->
          <button
            type="button"
            :class="[
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition-colors',
              pin
                ? 'border-ink/40 bg-ink text-page'
                : 'bg-surface text-muted hover:text-ink',
            ]"
            :aria-pressed="pin"
            @click="pin = !pin"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              class="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path
                d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z"
              />
              <path
                d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z"
              />
            </svg>
            <span class="tracking-wide">{{ pin ? '已置顶' : '置顶' }}</span>
          </button>

          <!-- Meta drawer trigger: 去掉小气泡数字徽章，简化为单行 -->
          <button
            type="button"
            :class="[
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition-colors',
              metaOpen
                ? 'border-ink/30 bg-surface text-ink'
                : 'bg-surface text-muted hover:text-ink',
            ]"
            :aria-expanded="metaOpen"
            aria-controls="meta-drawer"
            @click="metaOpen = !metaOpen"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              class="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path
                fill-rule="evenodd"
                d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10zm.75 4.5a.75.75 0 000 1.5h14.5a.75.75 0 000-1.5H2.75z"
                clip-rule="evenodd"
              />
            </svg>
            <span class="tracking-wide">摘要 · 封面</span>
            <span
              v-if="summary || cover"
              class="text-ink/60 ml-0.5 font-serif italic"
              aria-hidden="true"
            >
              ·
              {{
                [summary, cover].filter(Boolean).length === 1
                  ? '已填一项'
                  : '已填两项'
              }}
            </span>
          </button>
        </div>

        <!-- ─── Meta drawer: summary + cover ─── -->
        <ModalFadeTransition>
          <div
            v-if="metaOpen"
            id="meta-drawer"
            class="bg-surface/60 space-y-4 rounded-2xl border p-5"
          >
            <!-- Summary -->
            <div>
              <label
                class="text-muted mb-1.5 block font-serif text-[11px] tracking-wider uppercase italic"
              >
                摘要
              </label>
              <textarea
                v-model="summary"
                rows="2"
                maxlength="200"
                placeholder="两三行，写给读者的开场白…"
                class="text-ink placeholder:text-muted/60 bg-surface focus:border-ink/40 focus:ring-ink/10 w-full resize-none rounded-lg border px-3 py-2 font-serif text-sm leading-relaxed outline-0 focus:ring-1"
              />
              <p class="text-muted/60 mt-1 text-right font-mono text-[10px]">
                {{ summary.length }} / 200
              </p>
            </div>

            <!-- Cover -->
            <div>
              <label
                class="text-muted mb-1.5 block font-serif text-[11px] tracking-wider uppercase italic"
              >
                封面
              </label>
              <div class="flex gap-3">
                <div class="min-w-0 flex-1 space-y-2">
                  <input
                    v-model="cover"
                    type="text"
                    placeholder="粘贴封面 URL"
                    class="text-ink placeholder:text-muted/60 bg-surface focus:border-ink/40 focus:ring-ink/10 w-full rounded-lg border px-3 py-2 font-mono text-sm outline-0 focus:ring-1"
                  />
                  <div class="flex items-center gap-3 text-xs">
                    <input
                      ref="coverInputRef"
                      type="file"
                      accept="image/*"
                      class="hidden"
                      @change="handleCoverUpload"
                    />
                    <button
                      type="button"
                      :disabled="coverUploading"
                      class="text-muted hover:text-ink transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                      @click="coverInputRef?.click()"
                    >
                      {{ coverUploading ? '上传中…' : '上传图片' }}
                    </button>
                    <button
                      v-if="cover"
                      type="button"
                      class="text-muted/70 hover:text-ink transition-colors"
                      @click="cover = ''"
                    >
                      清除
                    </button>
                  </div>
                </div>
                <div
                  class="bg-surface h-20 w-28 shrink-0 overflow-hidden rounded-lg border"
                >
                  <img
                    v-if="cover"
                    :src="coverPreviewSrc"
                    :alt="`${title || '文章'} 封面预览`"
                    class="h-full w-full object-cover"
                  />
                  <div
                    v-else
                    class="text-muted/50 flex h-full w-full items-center justify-center font-serif text-[10px] italic"
                  >
                    无封面
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ModalFadeTransition>

        <!-- ─── The writing canvas ─── -->
        <!--
          桌面 · 抬起的一张纸。页面底色是 --secondary (bg-surface)，
          编辑器在它之上用 --page (bg-surface) 浮起，靠阴影分层。
        -->
        <div
          class="bg-surface /60 overflow-hidden rounded-2xl border shadow-[0_1px_0_0_oklch(from_var(--page)_l_c_h_/_0.6)_inset,0_2px_4px_-1px_oklch(from_var(--ink)_l_c_h_/_0.04),0_8px_24px_-8px_oklch(from_var(--ink)_l_c_h_/_0.12)]"
        >
          <div class="h-full">
            <MarkdownEditor ref="markdownEditorRef" v-model="markdownBody" />
          </div>
        </div>

        <!-- ─── Footer dock ─── -->
        <!--
          简化成三段：左 = 计量 · 中 = 自动保存（不用 bg-success/10 灯拼色，
          改用一行的字色 + 描线开关）· 右 = 取消 + 发布。
          用 sticky bottom 跟随滚动，bg-surface/85 backdrop-blur 与纸面对齐。
        -->
        <div
          class="text-muted /70 bg-surface/85 sticky bottom-3 -mx-3 flex items-center gap-3 rounded-2xl border px-4 py-2.5 text-xs shadow-sm backdrop-blur-md sm:mx-0"
        >
          <!-- 计量 -->
          <span class="hidden items-center gap-2 font-serif sm:inline-flex">
            <span>{{ wordCount }} 字</span>
            <span aria-hidden="true" class="text-border">·</span>
            <span class="italic">约 {{ readingMinutes }} 分钟</span>
          </span>

          <!-- 自动保存：把"自动/手动"改成单一 toggle，去掉 success 色块 -->
          <button
            type="button"
            :class="[
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors',
              autoSaveEnabled
                ? 'border-ink/30 bg-surface text-ink'
                : 'bg-surface text-muted hover:text-ink',
            ]"
            :title="
              autoSaveEnabled ? '自动保存 · ⌘S 手动触发' : '自动保存已关闭'
            "
            :aria-pressed="autoSaveEnabled"
            :aria-label="autoSaveEnabled ? '关闭自动保存' : '开启自动保存'"
            @click="autoSaveEnabled = !autoSaveEnabled"
          >
            <span
              :class="[
                'h-1.5 w-1.5 rounded-full transition-colors',
                autoSaveEnabled ? 'bg-ink/70' : 'bg-surface/30',
              ]"
              aria-hidden="true"
            ></span>
            <span class="tracking-wide">{{
              autoSaveEnabled ? '自动' : '手动'
            }}</span>
          </button>

          <span class="ml-auto flex items-center gap-1">
            <button
              type="button"
              class="text-muted hover:text-ink inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors"
              title="保存草稿 (⌘S)"
              aria-label="保存草稿"
              @click="handleSaveDraft"
            >
              <IconSave class="h-3 w-3" />
              <span class="tracking-wide">存草</span>
            </button>

            <span aria-hidden="true" class="text-border mx-1">·</span>

            <button
              type="button"
              class="text-muted hover:text-ink rounded-full px-3 py-1 transition-colors"
              @click="handleCancel"
            >
              取消
            </button>

            <UiButton
              type="submit"
              :disabled="loading"
              size="sm"
              class="rounded-full"
            >
              <svg
                v-if="loading"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                class="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              {{ isEdit ? '保存校样' : '发布新篇' }}
            </UiButton>
          </span>
        </div>
      </form>
    </div>
  </div>
</template>
