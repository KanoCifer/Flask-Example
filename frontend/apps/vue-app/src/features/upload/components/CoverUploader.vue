<script setup lang="ts">
/**
 * CoverUploader · 单图占位 + 上传 + 预览 + 清除 的复合控件。
 *
 * 设计要点:
 *  - 整体是一个 role="button" 可点击 / 可拖拽区域,行为统一。
 *  - 无封面: 显示上传提示(云图 + 文案 + hint)。
 *  - 有封面: 显示图片,hover 时半透明覆盖层提示"点击或拖拽以替换"。
 *  - 右上角 X 按钮清除(absolute,阻止冒泡避免触发 file picker)。
 *  - 上传中: 整个区域半透明 + 底部进度条。
 *  - 文件选择 / 校验 / 上传通过统一的 useUpload,
 *    失败通过 upload-error 事件上抛,由父级决定 toast / 日志处理。
 *
 * 不内嵌通用 UploadDropzone —— 那个是给大区域弹窗用的,
 * 这里直接写一份紧凑的样式,避免给同一意图套两层。
 */
import { computed, ref } from 'vue';
import { useOrigin } from '@readinglist/utils';
import { useUpload } from '@/features/upload/composables';
import type { UploadType } from '@/features/upload/api';
import UploadProgress from './UploadProgress.vue';
import { UploadCloud, X } from '@lucide/vue';

const props = withDefaults(
  defineProps<{
    /** 当前封面 URL(空字符串表示无封面)。 */
    cover: string;
    /** 上传类型,决定后端存储路径与校验策略。 */
    type: UploadType;
    /** CSS aspect-ratio 值(如 '16/9' / '4/3' / '1/1'),默认 '16/9'。 */
    aspect?: string;
    /** 图片 alt 文案。 */
    alt?: string;
    /** 禁用上传(灰化 + 不响应点击 / 拖拽)。 */
    disabled?: boolean;
    /** 空态主提示文案。 */
    prompt?: string;
    /** 空态辅助说明。 */
    hint?: string;
  }>(),
  {
    aspect: '16/9',
    alt: '封面预览',
    disabled: false,
    prompt: '点击或拖拽图片到此处',
    hint: '支持 JPG、PNG、WebP (最大 5MB)',
  },
);

const emit = defineEmits<{
  'update:cover': [value: string];
  'upload-error': [message: string];
}>();

const { upload, isUploading, progress } = useUpload({ type: props.type });

const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);

// 非 http(s) 开头的 src 用 https://api.kanocifer.chat 作为前缀(仅 https 环境)
const previewSrc = computed(() => (props.cover ? useOrigin(props.cover) : ''));

const hasCover = computed(() => !!props.cover);
const isInactive = computed(() => props.disabled || isUploading.value);

const triggerPicker = () => {
  if (isInactive.value) return;
  fileInputRef.value?.click();
};

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    triggerPicker();
  }
};

const uploadFile = async (file: File) => {
  try {
    const url = await upload(file);
    emit('update:cover', url);
  } catch (err) {
    console.error('[CoverUploader] 上传失败', err);
    emit('upload-error', '封面上传失败');
  }
};

const onFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = ''; // 清空,允许重复选择同一文件
  if (!file) return;
  await uploadFile(file);
};

const onDragOver = (event: DragEvent) => {
  if (isInactive.value) return;
  event.preventDefault();
};

const onDragEnter = (event: DragEvent) => {
  if (isInactive.value) return;
  event.preventDefault();
  isDragging.value = true;
};

const onDragLeave = (event: DragEvent) => {
  if (isInactive.value) return;
  event.preventDefault();
  isDragging.value = false;
};

const onDrop = async (event: DragEvent) => {
  if (isInactive.value) return;
  event.preventDefault();
  isDragging.value = false;
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  await uploadFile(file);
};

const onClear = () => {
  emit('update:cover', '');
};
</script>

<template>
  <div
    role="button"
    :tabindex="isInactive ? -1 : 0"
    :aria-disabled="isInactive"
    :aria-label="hasCover ? '点击或拖拽以替换封面' : prompt"
    :style="{ aspectRatio: aspect }"
    class="group bg-surface/40 text-ink relative w-full cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed transition-all outline-none select-none"
    :class="[
      hasCover
        ? 'border-border border-solid'
        : 'hover:border-muted-foreground hover:bg-surface',
      isDragging ? 'border-ink bg-surface scale-[0.99]' : '',
      isInactive ? 'pointer-events-none opacity-60' : '',
    ]"
    @click="triggerPicker"
    @keydown="onKeydown"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      class="hidden"
      :disabled="isInactive"
      @change="onFileChange"
    />

    <!-- Empty state -->
    <div
      v-if="!hasCover"
      class="flex h-full w-full flex-col items-center justify-center gap-1.5 p-6 text-center"
    >
      <div
        class="bg-page ring-border/5 mb-1 flex h-10 w-10 items-center justify-center rounded-full shadow-sm ring-1 transition-transform group-hover:scale-110"
      >
        <UploadCloud
          class="text-muted group-hover:text-ink h-5 w-5 transition-colors"
          :stroke-width="1.5"
        />
      </div>
      <p class="text-ink text-sm font-medium">{{ prompt }}</p>
      <p v-if="hint" class="text-muted text-xs">{{ hint }}</p>
    </div>

    <!-- Cover state -->
    <template v-else>
      <img :src="previewSrc" :alt="alt" class="h-full w-full object-cover" />

      <!-- Hover overlay: hint to replace -->
      <div
        class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <span
          class="rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-900 backdrop-blur"
        >
          点击或拖拽以替换
        </span>
      </div>

      <!-- Clear button -->
      <button
        type="button"
        aria-label="清除封面"
        class="bg-page/80 text-muted hover:text-ink absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full shadow-sm backdrop-blur-md transition-colors"
        @click.stop="onClear"
      >
        <X class="h-4 w-4" :stroke-width="2" />
      </button>
    </template>

    <!-- Upload progress -->
    <div
      v-if="isUploading"
      class="absolute inset-x-3 bottom-3 rounded bg-black/50 p-2 backdrop-blur"
    >
      <UploadProgress :progress="progress" />
    </div>
  </div>
</template>
