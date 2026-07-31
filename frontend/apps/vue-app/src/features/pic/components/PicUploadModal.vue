<template>
  <Teleport to="body">
    <ModalFadeTransition
      enter-from-class="opacity-0 backdrop-blur-none"
      enter-to-class="opacity-100 backdrop-blur-xl"
      leave-from-class="opacity-100 backdrop-blur-xl"
      leave-to-class="opacity-0 backdrop-blur-none"
    >
      <div
        v-if="visible"
        class="fixed inset-0 z-9999 flex items-center justify-center p-4"
        @click.self="$emit('close')"
      >
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/45 backdrop-blur-md"></div>

        <!-- Modal Content -->
        <motion.div
          :initial="{ opacity: 0, scale: 0.95, y: 10 }"
          :animate="{ opacity: 1, scale: 1, y: 0 }"
          :exit="{ opacity: 0, scale: 0.95, y: 10 }"
          :transition="{ type: 'spring', damping: 25, stiffness: 300 }"
          class="bg-page/95 /60 relative z-10 w-full max-w-md rounded-[2rem] border p-6 shadow-2xl backdrop-blur-2xl md:p-8"
        >
          <!-- Close Button -->
          <button
            @click="$emit('close')"
            class="text-muted hover:bg-surface hover:text-ink absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full transition-colors"
          >
            <X class="h-5 w-5" />
          </button>

          <!-- Header -->
          <div class="mb-6 text-center">
            <div
              class="bg-accent/10 text-ink mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
            >
              <UploadCloud class="h-6 w-6" />
            </div>
            <h3 class="text-ink text-xl font-bold tracking-tight">
              上传新图片
            </h3>
            <p class="text-muted mt-1 text-sm">添加到你的照片墙</p>
          </div>

          <!-- Upload Area -->
          <UploadDropzone
            accept="image/*"
            :disabled="isUploading"
            prompt="点击或拖拽图片到此处"
            hint="支持 JPG、PNG、GIF、WebP (最大 5MB)"
            @select="handleSelect"
          >
            <!-- Preview (shown inside dropzone once a file is selected) -->
            <div v-if="previewUrl" class="group/preview relative w-full">
              <img
                :src="previewUrl"
                alt="Preview"
                class="mx-auto max-h-48 rounded-xl object-contain shadow-md"
              />
              <div
                class="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 transition-opacity group-hover/preview:opacity-100"
              >
                <span
                  class="bg-page/30 rounded-full px-3 py-1.5 text-sm font-medium text-white backdrop-blur-md"
                  >更换图片</span
                >
              </div>
            </div>
          </UploadDropzone>

          <!-- Description Input -->
          <div class="mt-6">
            <label
              class="text-muted text-xs font-semibold tracking-wider uppercase"
            >
              照片描述（可选）
            </label>
            <input
              v-model="uploadDescription"
              type="text"
              placeholder="为这张图片添加描述..."
              class="text-ink placeholder:text-muted focus:border-ink focus:ring-ink /80 bg-page mt-2 w-full rounded-xl border px-4 py-3 text-sm shadow-sm transition-all focus:ring-1 focus:outline-none"
            />
          </div>

          <!-- Upload Progress -->
          <div v-if="isUploading" class="mt-4">
            <UploadProgress :progress="progress" />
          </div>

          <!-- Upload Error -->
          <p v-if="error" class="text-danger mt-2 text-xs">
            {{ error.message }}
          </p>

          <!-- Actions -->
          <div class="mt-8 flex gap-3">
            <Button
              variant="outline"
              class="flex-1"
              size="sm"
              @click="$emit('close')"
            >
              取消
            </Button>
            <Button
              class="flex-1"
              size="sm"
              :disabled="!canSubmit"
              @click="onConfirm"
            >
              <Loader2 v-if="isUploading" class="mr-2 h-4 w-4 animate-spin" />
              {{ isUploading ? '上传中...' : '确认上传' }}
            </Button>
          </div>
        </motion.div>
      </div>
    </ModalFadeTransition>
  </Teleport>
</template>

<script setup lang="ts">
import { Button } from '@/components';
import { ModalFadeTransition } from '@/components';
import { Loader2, UploadCloud, X } from '@lucide/vue';
import { motion } from 'motion-v';
import { useUpload } from '@/features/upload/composables';
import { UploadDropzone, UploadProgress } from '@/features/upload/components';
import { newPictureId, type Picture } from '@/features/pic/composables';
import { rewriteMediaUrl } from '@/composables';
import dayjs from 'dayjs';
import { computed, ref, watch } from 'vue';
import { useNotificationStore } from '@/stores';

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  close: [];
  uploaded: [image: Picture];
}>();

// 统一上传 composable —— 校验 + 上传 + 进度，返回服务端 URL。
const { upload, isUploading, progress, error } = useUpload({
  type: 'gallery',
  maxSize: 5 * 1024 * 1024,
  allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
});

const selectedFile = ref<File | null>(null);
const previewUrl = ref<string | null>(null);
const uploadDescription = ref('');

const canSubmit = computed(() => !!selectedFile.value && !isUploading.value);

// 从 UploadDropzone 收到文件后，记录文件并生成预览 blob URL。
const handleSelect = (files: File[]) => {
  const file = files[0];
  if (!file) return;
  selectedFile.value = file;
  previewUrl.value = URL.createObjectURL(file);
};

// 预览 URL 变化 / 卸载时释放旧 blob URL，避免内存泄漏。
watch(previewUrl, (_, prev) => {
  if (prev) URL.revokeObjectURL(prev);
});

const onConfirm = async () => {
  if (!selectedFile.value) return;

  try {
    const url = await upload(selectedFile.value);
    useNotificationStore().success('图片上传成功');

    const image: Picture = {
      id: newPictureId(),
      uploadedAt: dayjs().toISOString(),
      rawUrl: url,
      url: rewriteMediaUrl(url),
      description: uploadDescription.value || '',
    };

    emit('uploaded', image);
    emit('close');
  } catch {
    useNotificationStore().error('图片上传失败');
  }
};
</script>
