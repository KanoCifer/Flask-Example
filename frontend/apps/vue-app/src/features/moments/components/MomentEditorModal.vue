<template>
  <Modal :open="open" size="xl" @close="emit('update:open', false)">
    <!-- 顶栏 -->
    <header
      class="/40 bg-page sticky top-0 z-10 flex items-center justify-between gap-2 border-b px-6 py-4"
    >
      <div>
        <div
          class="text-muted font-mono text-[10px] tracking-[0.18em] uppercase"
        >
          {{ isEdit ? 'EDIT' : 'NEW' }} · {{ isEdit ? '编辑' : '写一句' }}
        </div>
        <h2 class="text-ink font-serif text-lg font-medium italic">
          {{ isEdit ? '改一改' : '碎碎念' }}
        </h2>
      </div>
      <Button
        variant="ghost"
        size="icon"
        class="/40 !h-7 !w-7 border"
        aria-label="关闭"
        @click="emit('update:open', false)"
      >
        <X class="h-3.5 w-3.5" />
      </Button>
    </header>

    <!-- 主体：左表单 + 右侧设置 -->
    <div
      class="grid max-h-[calc(88vh-72px)] grid-cols-1 gap-0 overflow-hidden md:grid-cols-[minmax(0,1fr)_220px]"
    >
      <form
        class="space-y-5 overflow-y-auto contain-[layout_paint_scroll_style] px-7 py-6"
        @submit.prevent="handleSubmit"
      >
        <!-- 内容 -->
        <div>
          <div class="mb-1.5 flex items-baseline gap-2">
            <label
              for="moment-content"
              class="text-ink font-serif text-sm font-medium"
              >内容</label
            >
            <span class="text-warning text-[11px]">*</span>
            <span class="text-muted text-[11px]"
              >必填 · 1~2000 字 · 支持 Markdown</span
            >
          </div>
          <textarea
            id="moment-content"
            ref="contentTextareaRef"
            v-model="form.content"
            rows="8"
            :maxlength="2000"
            placeholder="今天想到什么..."
            class="bg-page border-input text-ink placeholder:text-muted/60 focus:border-accent focus:ring-ring/20 min-h-[180px] w-full resize-y rounded-lg border px-4 py-3 font-serif text-[15px] leading-loose focus:ring-2 focus:outline-none"
          />
          <div
            class="text-muted mt-1.5 flex items-center justify-between font-mono text-[10px] tracking-wide"
          >
            <span v-if="lastSavedAt">已保存草稿 · {{ lastSavedAt }}</span>
            <span v-else>&nbsp;</span>
            <span :class="form.content.length > 2000 ? 'text-destructive' : ''"
              >{{ form.content.length }} / 2000</span
            >
          </div>
        </div>

        <!-- 附件(图片) -->
        <div>
          <div class="mb-1.5 flex items-baseline gap-2">
            <span class="text-ink font-serif text-sm font-medium">附件</span>
            <span class="text-muted text-[11px]"
              >图片 · 最多 {{ MAX_ATTACHMENTS }} 张 · 单张 ≤5MB</span
            >
            <span class="text-muted ml-auto font-mono text-[10px] tabular-nums"
              >{{ attachments.length }} / {{ MAX_ATTACHMENTS }}</span
            >
          </div>

          <!-- 空态:通用 UploadDropzone -->
          <UploadDropzone
            v-if="attachments.length === 0 && !previewUrl"
            accept="image/*"
            :disabled="isUploading"
            prompt="点击或拖拽图片到此处"
            :hint="`最多 ${MAX_ATTACHMENTS} 张,单张 ≤5MB`"
            @select="handleDropzoneSelect"
          />

          <!-- 非空态:3 列缩略图网格 -->
          <div v-else class="grid grid-cols-3 gap-2">
            <!-- 已上传图片 -->
            <div
              v-for="(att, idx) in attachments"
              :key="att.url"
              class="group bg-surface relative aspect-square overflow-hidden rounded-xl"
            >
              <img :src="att.url" alt="" class="h-full w-full object-cover" />
              <Button
                variant="ghost"
                size="icon"
                class="!bg-page/80 !text-ink hover:!bg-page absolute top-1.5 right-1.5 !h-6 !w-6 opacity-0 shadow-sm backdrop-blur-md transition-opacity group-hover:opacity-100"
                :aria-label="`删除图片 ${idx + 1}`"
                @click="removeAttachment(idx)"
              >
                <X class="h-3.5 w-3.5" />
              </Button>
            </div>

            <!-- 上传中 / 失败瓦片 -->
            <div
              v-if="previewUrl"
              class="bg-surface relative aspect-square overflow-hidden rounded-xl"
              :class="pendingError ? '' : 'opacity-60'"
              aria-busy="true"
            >
              <img
                :src="previewUrl"
                alt=""
                class="h-full w-full object-cover"
              />

              <!-- 上传中:中央暗罩 + 底部进度条 -->
              <template v-if="!pendingError">
                <div
                  class="absolute inset-0 flex items-center justify-center bg-black/30"
                >
                  <Loader2 class="h-5 w-5 animate-spin text-white" />
                </div>
                <UploadProgress
                  :progress="progress"
                  height="h-1"
                  class="absolute right-2 bottom-2 left-2"
                />
              </template>

              <!-- 失败:错误态 -->
              <div
                v-else
                class="border-destructive bg-page/95 absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 p-2 text-center backdrop-blur-md"
                role="alert"
              >
                <ImageOff class="text-destructive h-5 w-5" />
                <p class="text-destructive text-xs leading-tight font-medium">
                  {{ pendingError }}
                </p>
                <div class="flex gap-1.5">
                  <Button
                    variant="default"
                    class="!h-auto gap-1 !rounded-md !px-2 !py-1 !text-xs"
                    @click="retryUpload"
                  >
                    <RefreshCw class="h-3 w-3" />
                    重试
                  </Button>
                  <Button
                    variant="outline"
                    class="!bg-surface hover:!bg-surface/70 !h-auto !rounded-md !px-2 !py-1 !text-xs"
                    @click="removeFailed"
                  >
                    移除
                  </Button>
                </div>
              </div>
            </div>

            <!-- + 瓦片(沿用 SpotFormPanel 风格,不用第二个 UploadDropzone 以避免嵌套) -->
            <Button
              v-if="canAddMore"
              variant="ghost"
              class="!bg-surface hover:!bg-surface/70 relative !aspect-square !h-auto !w-full !flex-col !overflow-hidden !rounded-xl !border-2 !border-dashed !p-0"
              aria-label="添加图片"
              :title="`还可上传 ${MAX_ATTACHMENTS - attachments.length} 张`"
              @click="triggerAttachmentPicker"
            >
              <ImagePlus class="text-muted h-5 w-5" :stroke-width="1.5" />
              <span class="text-muted mt-1 text-xs">添加</span>
            </Button>
          </div>

          <!-- 隐藏 file input: + 瓦片 click 触发 -->
          <input
            ref="attachmentFileInputRef"
            type="file"
            accept="image/*"
            class="hidden"
            @change="onAttachmentInput"
          />
        </div>

        <!-- 心情 -->
        <div>
          <div class="mb-1.5 flex items-baseline gap-2">
            <label class="text-ink font-serif text-sm font-medium">心情</label>
            <span class="text-muted text-[11px]">emoji 或一个词</span>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <Button
              v-for="e in EMOJI_PRESETS"
              :key="e"
              variant="ghost"
              :class="[
                '!h-8 !w-8 !rounded-lg !border !p-0 !text-[16px]',
                form.mood === e
                  ? '!border-accent !bg-accent/10'
                  : '!bg-page hover:!bg-surface',
              ]"
              @click="toggleMood(e)"
            >
              {{ e }}
            </Button>
          </div>
          <!-- 动物徽标：每只动物 = 一个 emoji，注入 form.mood，与 emoji 行为一致 -->
          <div class="mt-2 flex flex-wrap gap-1.5">
            <button
              v-for="a in ANIMAL_MOODS"
              :key="a.alt"
              type="button"
              :title="a.label"
              :aria-label="a.label"
              :class="[
                'flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg border transition-all',
                form.mood === a.emoji
                  ? 'border-accent bg-accent/10 ring-accent/40 ring-1'
                  : 'border-input bg-page hover:bg-surface',
              ]"
              @click="toggleMood(a.emoji)"
            >
              <img
                :src="a.src"
                :alt="a.alt"
                class="h-7 w-7 object-cover"
                loading="lazy"
              />
            </button>
          </div>
          <input
            v-model="form.mood"
            type="text"
            maxlength="50"
            placeholder="或自定义心情..."
            class="bg-page border-input text-ink placeholder:text-muted/60 focus:border-accent focus:ring-ring/20 mt-2 w-full rounded-lg border px-3 py-1.5 text-[13px] focus:ring-2 focus:outline-none"
          />
        </div>

        <!-- 标签 -->
        <div>
          <div class="mb-1.5 flex items-baseline gap-2">
            <label class="text-ink font-serif text-sm font-medium">标签</label>
            <span class="text-muted text-[11px]">回车添加，× 删除 · ≤20</span>
          </div>
          <div
            class="bg-page border-input flex flex-wrap items-center gap-1.5 rounded-lg border px-2 py-1.5"
          >
            <span
              v-for="(tag, i) in form.tags"
              :key="tag + i"
              class="bg-surface text-ink inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px]"
            >
              <span class="text-ink/70 font-serif">#</span>{{ tag }}
              <Button
                variant="ghost"
                size="icon"
                class="!h-5 !w-5 !p-0"
                :aria-label="`删除标签 ${tag}`"
                @click="removeTag(i)"
              >
                ×
              </Button>
            </span>
            <input
              v-model="tagInput"
              type="text"
              maxlength="50"
              placeholder="新标签..."
              class="text-ink min-w-[80px] flex-1 bg-transparent px-1 text-[12px] outline-none"
              @keydown.enter.prevent="addTag"
              @keydown.,.prevent="addTag"
            />
          </div>
        </div>
      </form>

      <!-- 右侧设置 -->
      <aside
        class="bg-surface/30 /40 space-y-4 overflow-y-auto contain-[layout_paint_scroll_style] border-t px-5 py-6 md:border-t-0 md:border-l"
      >
        <div>
          <div
            class="text-muted mb-2 font-mono text-[10px] tracking-[0.15em] uppercase"
          >
            可见性
          </div>
          <div class="space-y-1.5">
            <label
              v-for="[v, l, d] in VIS_OPTIONS"
              :key="v"
              :class="[
                'flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2',
                form.visibility === v
                  ? 'border-accent bg-accent/5'
                  : '/40 bg-page hover:bg-surface',
              ]"
            >
              <input
                v-model="form.visibility"
                type="radio"
                :value="v"
                class="mt-1"
              />
              <div>
                <div class="text-ink text-[12px] font-medium">
                  {{ l }}
                </div>
                <div class="text-muted mt-0.5 text-[11px]">
                  {{ d }}
                </div>
              </div>
            </label>
          </div>
        </div>

        <div>
          <div
            class="text-muted mb-2 font-mono text-[10px] tracking-[0.15em] uppercase"
          >
            状态
          </div>
          <select
            v-model="form.status"
            class="bg-page border-input text-ink w-full rounded-lg border px-2.5 py-1.5 text-[13px]"
          >
            <option value="published">已发布</option>
            <option value="draft">草稿</option>
            <option value="archived">归档</option>
          </select>
        </div>

        <div>
          <div
            class="text-muted mb-2 font-mono text-[10px] tracking-[0.15em] uppercase"
          >
            选项
          </div>
          <label class="text-ink mb-1.5 flex items-center gap-2 text-[12px]">
            <input v-model="form.is_pinned" type="checkbox" /> 置顶
          </label>
          <label class="text-ink flex items-center gap-2 text-[12px]">
            <input v-model="form.allow_comment" type="checkbox" /> 允许评论
          </label>
        </div>

        <div class="space-y-2 pt-2">
          <Button
            variant="default"
            :disabled="submitting"
            class="!h-auto !w-full gap-1.5 !rounded-lg !px-3 !py-2 !text-[13px] shadow-sm disabled:!opacity-50"
            @click="handleSubmit"
          >
            {{ submitting ? '保存中…' : isEdit ? '保存修改' : '发布' }}
          </Button>
          <Button
            variant="outline"
            class="!h-auto !w-full !rounded-lg !px-3 !py-1.5 !text-[12px]"
            @click="emit('update:open', false)"
          >
            取消
          </Button>
        </div>
        <div class="text-muted text-center font-mono text-[10px] tracking-wide">
          ⌘ + S 保存
        </div>
      </aside>
    </div>
  </Modal>
</template>

<script setup lang="ts">
import { Button, Modal } from '@/components';
import { ImageOff, ImagePlus, Loader2, RefreshCw, X } from '@lucide/vue';
import { useUpload } from '@/features/upload/composables';
import { UploadDropzone, UploadProgress } from '@/features/upload/components';
import type {
  Moment,
  MomentAttachment,
  MomentStatus,
  MomentUpdatePayload,
  MomentVisibility,
} from '@readinglist/types';
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';

const EMOJI_PRESETS = [
  '🌿',
  '☕',
  '🌧',
  '📖',
  '🐟',
  '🌙',
  '☀',
  '🍃',
  '🎣',
  '✏',
  '💭',
  '🪴',
] as const;

// 动物徽标 → 对应 emoji。点击时把 emoji 写入 form.mood，与 EMOJI_PRESETS 走同一 toggleMood 路径。
const ANIMAL_MOODS = [
  {
    src: '/images/animal-badge/fox.png',
    alt: 'fox',
    emoji: '🦊',
    label: '机警',
  },
  {
    src: '/images/animal-badge/panda.png',
    alt: 'panda',
    emoji: '🐼',
    label: '慵懒',
  },
  {
    src: '/images/animal-badge/koala.png',
    alt: 'koala',
    emoji: '🐨',
    label: '呆萌',
  },
  {
    src: '/images/animal-badge/rabbit.png',
    alt: 'rabbit',
    emoji: '🐰',
    label: '活力',
  },
  {
    src: '/images/animal-badge/dog.png',
    alt: 'dog',
    emoji: '🐶',
    label: '忠诚',
  },
  {
    src: '/images/animal-badge/penguin.png',
    alt: 'penguin',
    emoji: '🐧',
    label: '冷静',
  },
] as const;

const VIS_OPTIONS: [MomentVisibility, string, string][] = [
  ['public', '公开', '任何访客可见'],
  ['unlisted', '不列出', '链接可访问，但不在列表'],
  ['private', '不公开', '仅自己'],
];

export interface MomentFormState {
  content: string;
  mood: string;
  tags: string[];
  visibility: MomentVisibility;
  status: MomentStatus;
  is_pinned: boolean;
  allow_comment: boolean;
}

const props = defineProps<{
  open: boolean;
  /** 编辑模式下传入；新建模式传 null */
  moment: Moment | null;
  submitting?: boolean;
  lastSavedAt?: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'submit', payload: MomentUpdatePayload): void;
  (e: 'save-draft'): void;
}>();

const isEdit = computed(() => !!props.moment);

const form = reactive<MomentFormState>({
  content: '',
  mood: '',
  tags: [],
  visibility: 'public',
  status: 'published',
  is_pinned: false,
  allow_comment: true,
});

const tagInput = ref('');


// ── 附件(图片) ──────────────────────────────────────────
// 复用 useUpload(type='gallery')，与 SpotFormPanel / PicUploadModal 同源。
// attachments 与 form 分离：form 走 reactive，attachments 自身带「上传中 + 已成功」状态。
const MAX_ATTACHMENTS = 9;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

const attachments = ref<MomentAttachment[]>([]);
const selectedFile = ref<File | null>(null);
const previewUrl = ref<string | null>(null);
const pendingError = ref<string | null>(null);
const attachmentFileInputRef = ref<HTMLInputElement | null>(null);

const { upload, isUploading, progress } = useUpload({
  type: 'gallery',
  maxSize: MAX_UPLOAD_BYTES,
  allowedTypes: ALLOWED_IMAGE_TYPES,
});

const canAddMore = computed(
  () =>
    attachments.value.length < MAX_ATTACHMENTS &&
    !previewUrl.value &&
    !isUploading.value,
);

/** 通用 UploadDropzone `@select` 适配：取首个文件走校验/预览/自动上传链。 */
function handleDropzoneSelect(files: File[]) {
  const f = files[0];
  if (f) startUpload(f);
}

function startUpload(file: File) {
  if (!canAddMore.value) return;
  selectedFile.value = file;
  previewUrl.value = URL.createObjectURL(file);
}

/** 释放旧预览 object URL，避免内存泄漏。 */
watch(previewUrl, (_, prev) => {
  if (prev) URL.revokeObjectURL(prev);
});

/** 选中文件后立刻触发 upload(串行)。 */
watch(selectedFile, async (file) => {
  if (file) await runUpload(file);
});

/**
 * 选中文件后立刻触发 upload(串行)。
 * 与 retryUpload 共用一条上传链 — 失败保留 preview,可重试。
 *
 * 守卫：上传期间用户可能切换了 moment 或重新选文件；`selectedFile.value`
 * 不再等于 `file` 时丢弃结果，避免把上一次 in-flight 上传的 URL 写入
 * 新的 moment attachments。
 */
async function runUpload(file: File): Promise<void> {
  pendingError.value = null;
  try {
    const url = await upload(file);
    if (selectedFile.value !== file) return;
    attachments.value.push({ type: 'image', url });
    selectedFile.value = null;
    previewUrl.value = null;
  } catch {
    if (selectedFile.value !== file) return;
    pendingError.value = '图片上传失败,请重试';
  }
}

/** 打开 / 切换编辑对象时重置草稿(包括 attachments)。 */
watch(
  () => [props.open, props.moment?.id] as const,
  ([isOpen]) => {
    if (!isOpen) return;
    const m = props.moment;
    if (m) {
      form.content = m.content;
      form.mood = m.mood ?? '';
      form.tags = [...m.tags];
      form.visibility = m.visibility;
      form.status = m.status;
      form.is_pinned = m.is_pinned;
      form.allow_comment = m.allow_comment;
      attachments.value = m.attachments.filter((a) => a.type === 'image');
    } else {
      form.content = '';
      form.mood = '';
      form.tags = [];
      form.visibility = 'public';
      form.status = 'published';
      form.is_pinned = false;
      form.allow_comment = true;
      attachments.value = [];
    }
    tagInput.value = '';
    selectedFile.value = null;
    previewUrl.value = null;
    pendingError.value = null;
  },
  { immediate: true },
);

function removeAttachment(idx: number) {
  // 编辑模式：对已存在的服务器附件删除走 confirm,避免误删。
  // 新建模式上传尚未落库,直接移除。
  if (isEdit.value) {
    const ok = window.confirm('确定删除这张图片吗?');
    if (!ok) return;
  }
  attachments.value.splice(idx, 1);
}

async function retryUpload(): Promise<void> {
  if (!selectedFile.value || isUploading.value) return;
  await runUpload(selectedFile.value);
}

function removeFailed(): void {
  selectedFile.value = null;
  previewUrl.value = null;
  pendingError.value = null;
}

function onAttachmentInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  const f = target.files?.[0];
  if (f) startUpload(f);
  // 重置 input value,使再次选择同一文件能触发 change。
  target.value = '';
}

function triggerAttachmentPicker(): void {
  attachmentFileInputRef.value?.click();
}

/** 卸载时回收可能仍存在的预览 blob URL。 */
onBeforeUnmount(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
});

function toggleMood(emoji: string) {
  form.mood = form.mood === emoji ? '' : emoji;
}

function addTag() {
  const v = tagInput.value.trim().slice(0, 50);
  if (!v) return;
  if (form.tags.includes(v)) {
    tagInput.value = '';
    return;
  }
  if (form.tags.length >= 20) return;
  form.tags.push(v);
  tagInput.value = '';
}

function removeTag(idx: number) {
  form.tags.splice(idx, 1);
}

function handleSubmit() {
  const trimmed = form.content.trim();
  if (!trimmed || trimmed.length > 2000) return;
  // 上传未完成时禁止提交，避免丢失未持久化的附件。
  if (isUploading.value) return;
  const payload: MomentUpdatePayload = {
    content: trimmed,
    mood: form.mood || null,
    tags: form.tags,
    visibility: form.visibility,
    status: form.status,
    is_pinned: form.is_pinned,
    allow_comment: form.allow_comment,
    attachments: attachments.value,
  };
  emit('submit', payload);
}
</script>
