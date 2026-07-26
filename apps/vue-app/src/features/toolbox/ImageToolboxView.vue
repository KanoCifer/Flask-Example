<template>
  <BasicDetail title="图片工具箱" subtitle="本地压缩与格式转换">
    <div class="col-span-full">
      <div class="squircle /60 bg-page/50 overflow-hidden border shadow-sm">
        <div class="flex flex-col lg:flex-row lg:items-stretch">
          <!-- 左侧配置面板 -->
          <aside
            class="/60 w-full shrink-0 border-b p-6 lg:w-80 lg:border-r lg:border-b-0"
          >
            <header class="mb-8">
              <h2 class="text-ink text-xl font-bold">参数配置</h2>
              <p class="text-muted mt-1 text-xs">本地处理，保护隐私安全</p>
            </header>

            <div class="space-y-8">
              <!-- 尺寸限制 -->
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <label for="max-width" class="text-ink text-sm font-semibold">
                    最大宽度限制
                  </label>
                  <button
                    id="max-width-toggle"
                    type="button"
                    role="switch"
                    :aria-checked="enableMaxWidth"
                    :aria-label="'最大宽度限制'"
                    :class="[
                      'switch',
                      enableMaxWidth ? 'switch--on' : 'switch--off',
                    ]"
                    @click="enableMaxWidth = !enableMaxWidth"
                  >
                    <svg
                      v-if="enableMaxWidth"
                      aria-hidden="true"
                      class="switch__icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="3"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                </div>
                <div class="relative">
                  <input
                    id="max-width"
                    v-model.number="maxWidth"
                    type="number"
                    min="1"
                    :disabled="!enableMaxWidth"
                    class="text-ink placeholder:text-muted focus:border-ink bg-page disabled:bg-surface disabled:text-muted w-full rounded-xl border px-4 py-2.5 text-sm transition-all focus:ring-0 focus:outline-none"
                  />
                  <span
                    class="text-muted absolute top-1/2 right-4 -translate-y-1/2 text-xs"
                    >px</span
                  >
                </div>
              </div>

              <!-- 压缩质量 -->
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <label for="quality" class="text-ink text-sm font-semibold">
                    压缩质量
                  </label>
                  <span class="text-muted font-mono text-xs font-medium">
                    {{ Math.round(quality * 100) }}%
                  </span>
                </div>
                <Slider
                  :default-value="[0.8]"
                  :min="0.3"
                  :max="1"
                  :step="0.1"
                  v-model="qualityArray"
                />
                <div
                  class="text-muted flex justify-between text-[10px] uppercase"
                >
                  <span>高压缩</span>
                  <span>原画</span>
                </div>
              </div>

              <!-- 输出格式 -->
              <div class="space-y-3">
                <span class="text-ink text-sm font-semibold">输出格式</span>
                <div class="grid grid-cols-3 gap-2">
                  <button
                    v-for="option in outputTypes"
                    :key="option.value"
                    type="button"
                    class="rounded-xl border py-2 text-xs font-medium transition-all"
                    :class="
                      outputType === option.value
                        ? 'border-ink bg-ink text-page'
                        : 'bg-page text-muted hover:border-muted'
                    "
                    @click="outputType = option.value"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>

              <!-- 导出文件名 -->
              <div v-if="originalFile" class="space-y-3">
                <div class="flex items-center justify-between">
                  <label for="file-name" class="text-ink text-sm font-semibold">
                    导出文件名
                  </label>
                  <span
                    class="text-muted font-mono text-[10px] font-medium tracking-wider uppercase"
                  >
                    扩展名: {{ outputTypeLabel }}
                  </span>
                </div>
                <input
                  id="file-name"
                  v-model="customFileName"
                  type="text"
                  spellcheck="false"
                  placeholder="留空则使用原文件名"
                  class="text-ink placeholder:text-muted focus:border-ink bg-page w-full rounded-xl border px-4 py-2.5 text-sm transition-all focus:ring-0 focus:outline-none"
                />
              </div>

              <!-- 操作按钮 -->
              <div class="grid grid-cols-1 gap-3 pt-4">
                <button
                  type="button"
                  :disabled="!originalFile || processing"
                  class="bg-ink text-page hover:bg-ink/90 group relative overflow-hidden rounded-xl py-3 text-sm font-bold transition-all"
                  @click="process"
                >
                  <span
                    v-if="processing"
                    class="flex items-center justify-center gap-2"
                  >
                    <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                      <circle
                        class="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        stroke-width="4"
                        fill="none"
                      />
                      <path
                        class="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    正在处理
                  </span>
                  <span v-else>开始处理</span>
                </button>

                <button
                  type="button"
                  :disabled="!processedBlob"
                  class="text-ink hover:bg-surface bg-page flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium shadow-md transition-all hover:scale-105 hover:shadow-lg disabled:opacity-50"
                  @click="download"
                >
                  <svg
                    class="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  下载结果
                </button>

                <button
                  type="button"
                  class="text-muted hover:text-ink py-2 text-xs font-medium"
                  @click="resetAll"
                >
                  清空并重置
                </button>
              </div>
            </div>
          </aside>

          <!-- 右侧工作区 -->
          <main class="bg-surface/50 flex-1 p-6 dark:bg-black/20">
            <div class="mx-auto max-w-5xl space-y-6">
              <!-- 拖放上传区 -->
              <div
                ref="dropZoneRef"
                class="group relative flex min-h-50 cursor-pointer items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-500"
                :class="
                  isOverDropZone
                    ? 'border-ink bg-ink/5'
                    : originalFile
                      ? 'bg-page border-transparent shadow-sm'
                      : 'bg-page hover:border-muted'
                "
                @click="triggerFilePicker"
              >
                <!-- 动态背景装饰 -->
                <div
                  v-if="isOverDropZone"
                  class="bg-ink/5 absolute inset-0 animate-pulse"
                ></div>

                <div class="relative z-10 p-8 text-center">
                  <div v-if="!originalFile" class="space-y-4">
                    <div
                      class="bg-surface text-muted mx-auto flex h-16 w-16 items-center justify-center rounded-2xl transition-transform group-hover:scale-110"
                    >
                      <svg
                        class="h-8 w-8"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="1.5"
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p class="text-ink text-base font-bold">
                        {{ isOverDropZone ? '即刻上传' : '点击或拖拽图片' }}
                      </p>
                      <p class="text-muted mt-1 text-xs">
                        支持 JPG, PNG, WebP, GIF, AVIF (最大 20MB)
                      </p>
                    </div>
                  </div>

                  <div
                    v-else
                    class="flex flex-wrap items-center justify-center gap-6"
                  >
                    <div class="flex items-center gap-4">
                      <div
                        class="bg-surface h-12 w-12 overflow-hidden rounded-lg"
                      >
                        <img
                          :src="originalPreviewUrl"
                          class="h-full w-full object-cover"
                        />
                      </div>
                      <div class="text-left">
                        <p class="text-ink max-w-50 truncate text-sm font-bold">
                          {{ originalFile.name }}
                        </p>
                        <p class="text-muted text-xs">
                          {{ formatBytes(originalFile.size) }}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      class="text-ink bg-page ring-border hover:bg-surface rounded-full px-4 py-1.5 text-xs font-bold shadow-sm ring-1 transition-all"
                      @click.stop="triggerFilePicker"
                    >
                      更换图片
                    </button>
                  </div>
                </div>

                <input
                  ref="fileInputRef"
                  type="file"
                  accept="image/*"
                  class="hidden"
                  @change="handleFileChange"
                />
              </div>

              <!-- 预览对比区 -->
              <div
                v-if="originalFile"
                class="grid grid-cols-1 gap-6 md:grid-cols-2"
              >
                <!-- 原图预览 -->
                <div
                  class="group bg-page relative flex flex-col overflow-hidden rounded-3xl shadow-sm"
                >
                  <div
                    class="/50 flex items-center justify-between border-b p-4"
                  >
                    <span
                      class="text-muted text-xs font-bold tracking-wider uppercase"
                      >原始图像</span
                    >
                    <div class="flex items-center gap-2">
                      <span class="text-muted text-[10px]"
                        >缩放:
                        {{ Math.round(originalPreviewZoom * 100) }}%</span
                      >
                      <button
                        @click="originalPreviewZoom = 1"
                        class="text-muted hover:text-ink text-[10px]"
                      >
                        重置
                      </button>
                    </div>
                  </div>
                  <div
                    class="bg-surface/50 relative flex min-h-[320px] items-center justify-center overflow-auto p-8"
                  >
                    <button
                      type="button"
                      class="cursor-zoom-in transition-transform duration-300 group-hover:scale-[1.02]"
                      @click="openPreview(originalPreviewUrl, '原图预览')"
                    >
                      <img
                        :src="originalPreviewUrl"
                        alt="原图预览"
                        :style="{
                          transform: `scale(${originalPreviewZoom})`,
                          transformOrigin: 'center center',
                        }"
                        class="max-h-60 w-auto max-w-none rounded-lg object-contain shadow-sm"
                      />
                    </button>
                  </div>
                  <div
                    class="absolute bottom-4 left-1/2 w-32 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <input
                      v-model.number="originalPreviewZoom"
                      type="range"
                      min="1"
                      max="4"
                      step="0.1"
                      class="accent-muted h-1 w-full"
                    />
                  </div>
                </div>

                <!-- 处理后预览 -->
                <div
                  class="group bg-page relative flex flex-col overflow-hidden rounded-3xl shadow-sm"
                >
                  <div
                    class="/50 flex items-center justify-between border-b p-4"
                  >
                    <div class="flex items-center gap-2">
                      <span
                        class="text-muted text-xs font-bold tracking-wider uppercase"
                        >处理后:{{
                          formatBytes(processedBlob?.size ?? 0) || '0 KB'
                        }}</span
                      >
                      <span
                        v-if="processedBlob"
                        class="bg-success/10 text-success rounded-full px-2 py-0.5 text-[10px] font-bold"
                      >
                        {{ compressionRatio }} 节省
                      </span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-muted text-[10px]"
                        >缩放:
                        {{ Math.round(processedPreviewZoom * 100) }}%</span
                      >
                      <button
                        @click="processedPreviewZoom = 1"
                        class="text-muted hover:text-ink text-[10px]"
                      >
                        重置
                      </button>
                    </div>
                  </div>
                  <div
                    class="bg-surface/50 relative flex min-h-[320px] items-center justify-center overflow-auto p-8"
                  >
                    <div
                      v-if="processing"
                      class="flex flex-col items-center gap-3"
                    >
                      <div
                        class="border-ink h-8 w-8 animate-spin rounded-full border-2 border-t-transparent"
                      ></div>
                      <span class="text-muted text-xs">正在渲染...</span>
                    </div>
                    <button
                      v-else-if="processedPreviewUrl"
                      type="button"
                      class="cursor-zoom-in transition-transform duration-300 group-hover:scale-[1.02]"
                      @click="openPreview(processedPreviewUrl, '处理后预览')"
                    >
                      <img
                        :src="processedPreviewUrl"
                        alt="处理后预览"
                        :style="{
                          transform: `scale(${processedPreviewZoom})`,
                          transformOrigin: 'center center',
                        }"
                        class="max-h-60 w-auto max-w-none rounded-lg object-contain shadow-sm"
                      />
                    </button>
                    <div v-else class="text-center text-gray-300">
                      <svg
                        class="mx-auto h-12 w-12 opacity-20"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="1.5"
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                      <p class="mt-2 text-xs">调整参数后点击"开始处理"</p>
                    </div>
                  </div>
                  <div
                    v-if="processedPreviewUrl"
                    class="absolute bottom-4 left-1/2 w-32 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <input
                      v-model.number="processedPreviewZoom"
                      type="range"
                      min="1"
                      max="4"
                      step="0.1"
                      class="accent-muted h-1 w-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            <p
              v-if="errorMessage"
              class="bg-destructive/10 text-destructive mx-auto mt-6 max-w-md rounded-xl p-3 text-center text-xs font-medium"
            >
              {{ errorMessage }}
            </p>
          </main>
        </div>
      </div>

      <!-- 全屏预览 -->
      <teleport to="body">
        <ModalFadeTransition>
          <div
            v-if="isPreviewDialogOpen"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-md"
            @click.self="closePreviewDialog"
          >
            <button
              type="button"
              class="absolute top-6 right-6 h-10 w-10 rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              @click="closePreviewDialog"
            >
              ✕
            </button>
            <img
              :src="previewDialogUrl"
              :alt="previewDialogAlt"
              class="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            />
          </div>
        </ModalFadeTransition>
      </teleport>
    </div>
  </BasicDetail>
</template>

<script setup lang="ts">
import { BasicDetail, Slider, ModalFadeTransition } from '@/components';
import { useImageProcessor } from '@/features/toolbox/composables/useImageProcessor';
import { usePreviewDialog } from '@/composables';
import { formatBytes } from '@/features/toolbox/lib/image';
import { useDropZone } from '@vueuse/core';
import { computed, useTemplateRef } from 'vue';

const dropZoneRef = useTemplateRef('dropZoneRef');

const {
  fileInputRef,
  originalFile,
  processedBlob,
  originalPreviewUrl,
  processedPreviewUrl,
  originalPreviewZoom,
  processedPreviewZoom,
  processing,
  errorMessage,
  customFileName,
  maxWidth,
  enableMaxWidth,
  quality,
  qualityArray,
  outputType,
  outputTypes,
  compressionRatio,
  handleFileChange,
  selectFile,
  process,
  download,
  triggerFilePicker,
  resetAll,
} = useImageProcessor();

const outputTypeLabel = computed(
  () =>
    outputTypes.find(
      (option: { label: string; value: string }) =>
        option.value === outputType.value,
    )?.label ?? '',
);

const {
  isOpen: isPreviewDialogOpen,
  url: previewDialogUrl,
  alt: previewDialogAlt,
  open: openPreview,
  close: closePreviewDialog,
} = usePreviewDialog();

// 拖放上传：把 drop zone 结果统一交给文件处理函数，避免逻辑分叉
const { isOverDropZone } = useDropZone(dropZoneRef, {
  onDrop(files) {
    if (!files?.length) {
      return;
    }
    const firstImage = files.find((file) => file.type.startsWith('image/'));
    if (firstImage) {
      selectFile(firstImage);
    }
  },
  multiple: false,
  dataTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
  ],
});
</script>

<style scoped>
.switch {
  position: relative;
  display: inline-flex;
  height: 1.5rem; /* 24px (h-6) */
  width: 2.75rem; /* 44px (w-11) */
  flex-shrink: 0;
  cursor: pointer;
  align-items: center;
  border-radius: 9999px;
  border: 1px solid;
  transition:
    background-color 200ms ease-out,
    border-color 200ms ease-out;
}

.switch--off {
  background-color: var(--color-input);
  border-color: var(--color-input);
}

.switch--on {
  background-color: var(--color-accent);
  border-color: var(--color-accent);
}

/* 拇指用 ::after 伪元素实现，left 在 0.25rem / 1.5rem 之间切换 */
.switch::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 0.25rem; /* off: left-1 */
  width: 1rem; /* 16px (w-4) */
  height: 1rem;
  border-radius: 9999px;
  background-color: var(--color-page);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.12);
  transform: translateY(-50%);
  transition: left 200ms ease-out;
}

.switch--on::after {
  left: 1.5rem; /* on: left-6 */
}

.switch__icon {
  pointer-events: none;
  position: absolute;
  top: 50%;
  right: 0.625rem; /* 对齐 on 状态拇指中心 (32px from left = 12px from right) */
  width: 0.625rem; /* 10px (h-2.5) */
  height: 0.625rem;
  color: var(--color-accent);
  transform: translateY(-50%);
  z-index: 1;
}

.switch:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 2px var(--color-card),
    0 0 0 4px var(--color-ring);
}
</style>
