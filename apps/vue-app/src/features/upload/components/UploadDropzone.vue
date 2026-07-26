<script setup lang="ts">
/**
 * UploadDropzone —— 通用文件拖拽 / 点击选择区域。
 *
 * - 点击或拖拽到此处都会触发文件选择。
 * - dragover 时高亮边框 / 背景作为视觉反馈。
 * - 选择完成后 emit `select`，把 File 数组交给上层处理（上传 / 预览）。
 *
 * 设计参考 PicUploadModal 的拖拽块，样式全部用语义化 Tailwind token。
 */
import { ref } from 'vue';
import { UploadCloud } from '@lucide/vue';

const {
  accept,
  multiple,
  disabled,
  prompt = '点击或拖拽文件到此处',
  hint = '支持单文件上传',
} = defineProps<{
  /** 原生 <input type="file"> 的 accept 字符串（如 "image/*"）。 */
  accept?: string;
  /** 是否多选。 */
  multiple?: boolean;
  /** 禁用态：禁用点击与拖拽，灰化样式。 */
  disabled?: boolean;
  /** 主提示文案（第一行）。 */
  prompt?: string;
  /** 辅助说明（第二行，灰色小字）。 */
  hint?: string;
}>();

const emit = defineEmits<{
  /** 用户完成一次选择（点击或拖拽），附带 File 数组。 */
  select: [files: File[]];
}>();

const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);

// 计数器避免子元素触发的 dragleave 误判为"已离开 dropzone"
let dragCounter = 0;

const triggerFileInput = () => {
  fileInputRef.value?.click();
};

const handleClick = () => {
  if (disabled) return;
  triggerFileInput();
};

const onInputChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;
  emit('select', Array.from(target.files));
  // 清空 input，允许重复选择同一文件
  target.value = '';
};

const onDragEnter = (event: DragEvent) => {
  if (disabled) return;
  event.preventDefault();
  dragCounter += 1;
  isDragging.value = true;
};

const onDragOver = (event: DragEvent) => {
  if (disabled) return;
  event.preventDefault();
};

const onDragLeave = (event: DragEvent) => {
  if (disabled) return;
  event.preventDefault();
  dragCounter = Math.max(0, dragCounter - 1);
  if (dragCounter === 0) isDragging.value = false;
};

const onDrop = (event: DragEvent) => {
  if (disabled) return;
  event.preventDefault();
  dragCounter = 0;
  isDragging.value = false;
  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) return;
  emit('select', Array.from(files));
};
</script>

<template>
  <div
    role="button"
    :tabindex="disabled ? -1 : 0"
    :aria-disabled="disabled"
    class="group bg-surface/40 text-ink hover:border-muted-foreground hover:bg-surface relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all select-none"
    :class="[
      isDragging ? 'border-ink bg-surface scale-[0.99]' : '',
      disabled ? 'cursor-not-allowed opacity-60' : '',
    ]"
    @click="handleClick"
    @keydown.enter.prevent="handleClick"
    @keydown.space.prevent="handleClick"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
  >
    <input
      ref="fileInputRef"
      type="file"
      class="hidden"
      :accept="accept"
      :multiple="multiple"
      :disabled="disabled"
      @change="onInputChange"
    />

    <div
      class="bg-page ring-border/5 mb-4 flex h-12 w-12 items-center justify-center rounded-full shadow-sm ring-1 transition-transform group-hover:scale-110"
    >
      <UploadCloud
        class="text-muted group-hover:text-ink h-5 w-5 transition-colors"
        :stroke-width="1.5"
      />
    </div>
    <p class="text-ink text-sm font-medium">{{ prompt }}</p>
    <p v-if="hint" class="text-muted mt-2 text-xs">{{ hint }}</p>
    <slot />
  </div>
</template>
