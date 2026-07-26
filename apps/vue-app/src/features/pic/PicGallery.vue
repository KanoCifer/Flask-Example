<template>
  <div class="bg-page min-h-screen w-full overflow-x-hidden overflow-y-auto">
    <!-- Subtle Dot Pattern Background -->
    <div
      class="text-muted/40 pointer-events-none fixed inset-0 z-0 opacity-40 dark:opacity-20"
      style="
        background-image: radial-gradient(
          circle at 1px 1px,
          currentColor 1.5px,
          transparent 0
        );
        background-size: 32px 32px;
      "
    ></div>

    <PicGalleryEditBar
      :can-edit="canEdit"
      :is-edit-mode="isEditMode"
      :selected-count="selectedIds.size"
      @toggle-edit="toggleEditMode"
      @shuffle="shuffleImages"
      @upload="openUploadModal"
      @delete-selected="deleteSelected"
    />

    <!--
      Gallery Container —— 纯 CSS 多列瀑布流
      columns 控制列数、column-gap 控制间距；卡片 break-inside: avoid 防拆断、
      margin-bottom 提供列内垂直间距。卡片已在组件内通过 aspect-ratio 预留高度，
      加载时不跳动。
    -->
    <div
      class="gallery-masonry relative z-10 mx-auto w-full max-w-[1400px] px-4 pt-24 pb-32 sm:px-6"
    >
      <!-- Polaroid Cards -->
      <motion.div
        v-for="(image, index) in images"
        :key="image.id"
        class="gallery-item"
        :initial="{ opacity: 0, y: 24 }"
        :animate="{ opacity: 1, y: 0 }"
        :transition="{
          type: 'spring',
          stiffness: 220,
          damping: 24,
          duration: 0.5,
          delay: Math.min(index * 0.03, 0.4),
        }"
      >
        <PolaroidCard
          :image="image"
          :index="index"
          :aspect="getAspectRatio(index)"
          :rotation="getRotation(index)"
          :is-edit-mode="isEditMode && canEdit"
          :selected="selectedIds.has(image.id)"
          @select="openImageDetail"
          @toggle-select="toggleSelect"
          @delete="onDeleteImage"
        />
      </motion.div>

      <!-- Empty State -->
      <div
        v-if="images.length === 0"
        class="gallery-empty flex h-[60vh] flex-col items-center justify-center"
      >
        <div
          class="bg-card relative max-w-md space-y-3 rounded-3xl border p-10 text-center shadow-2xl"
        >
          <img
            src="/images/animal-badge/fox.png"
            alt="Fox"
            class="mx-auto mb-6 h-24 w-24"
            loading="lazy"
          />
          <h3 class="text-ink text-xl font-bold tracking-tight">还没有图片</h3>
          <p class="text-muted mt-2 text-sm">
            你的图片墙就像一张白纸，点击上方按钮上传第一张照片吧
          </p>
          <Button
            v-if="canEdit"
            class="rounded-full"
            size="sm"
            @click="openUploadModal"
          >
            开始上传
          </Button>
        </div>
      </div>
    </div>

    <PicDetailModal
      :image="selectedImage"
      :editable="canEdit && isEditMode"
      :formatted-date="
        selectedImage ? formatDate(selectedImage.uploadedAt) : ''
      "
      :frame-no="selectedIndex + 1"
      :exif="selectedImage?.exif ?? undefined"
      @close="closeImageDetail"
      @update="onUpdateDescription"
      @delete="onDeleteImage"
      @prev="navigateImage(-1)"
      @next="navigateImage(1)"
    />

    <PicUploadModal
      :visible="showUploadModal"
      @close="showUploadModal = false"
      @uploaded="onImageUploaded"
    />
  </div>
</template>

<script setup lang="ts">
import PicGalleryEditBar from './components/PicGalleryEditBar.vue';
import PicDetailModal from './components/PicDetailModal.vue';
import PicUploadModal from './components/PicUploadModal.vue';
import PolaroidCard from './components/PolaroidCard.vue';
import { Button } from '@/components';
import {
  useGallery,
  usePolaroidLayout,
  type Picture,
} from '@/features/pic/composables';
import { useAuthStore } from '@/features/auth';
import { useNotificationStore } from '@/stores';
import { motion } from 'motion-v';
import { computed, onMounted, ref, watch } from 'vue';

const authStore = useAuthStore();
const canEdit = computed(() => authStore.isAdmin);

// --- domain composables ---
const {
  images,
  fetchGalleryImages,
  saveGallery,
  updateDescription,
  deleteImage,
  formatDate,
} = useGallery();

const { generateLayoutSeeds, shuffleImages, getAspectRatio, getRotation } =
  usePolaroidLayout({ images });

// --- edit mode ---
const isEditMode = ref(false);
// 编辑模式选中的图片 id 集合
const selectedIds = ref<Set<string>>(new Set());

const ensureAdminPermission = () => {
  if (!canEdit.value) {
    useNotificationStore().error('仅管理员可编辑图片');
    return false;
  }
  return true;
};

const toggleEditMode = () => {
  if (!ensureAdminPermission()) return;
  isEditMode.value = !isEditMode.value;
  if (!isEditMode.value) selectedIds.value.clear();
};

const toggleSelect = (id: string) => {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id);
  } else {
    selectedIds.value.add(id);
  }
  // 触发响应式更新（Set 原地变更需要重新赋值）
  selectedIds.value = new Set(selectedIds.value);
};

const deleteSelected = async () => {
  if (selectedIds.value.size === 0) {
    useNotificationStore().info('请先选中要删除的照片');
    return;
  }
  if (!ensureAdminPermission()) return;
  const ids = Array.from(selectedIds.value);
  for (const id of ids) {
    await deleteImage(id);
  }
  selectedIds.value = new Set();
  generateLayoutSeeds();
  useNotificationStore().success(`已删除 ${ids.length} 张照片`);
};

// --- upload modal ---
const showUploadModal = ref(false);

const openUploadModal = () => {
  if (!ensureAdminPermission()) return;
  showUploadModal.value = true;
};

watch(canEdit, (value) => {
  if (!value) {
    isEditMode.value = false;
    showUploadModal.value = false;
    selectedIds.value.clear();
  }
});

// --- detail modal ---
const selectedImage = ref<Picture | null>(null);
const selectedIndex = ref(-1);

const openImageDetail = (image: Picture, index: number) => {
  if (isEditMode.value) return; // 编辑模式下不进详情
  selectedImage.value = image;
  selectedIndex.value = index;
};

const closeImageDetail = () => {
  selectedImage.value = null;
  selectedIndex.value = -1;
};

const navigateImage = (delta: number) => {
  if (images.value.length === 0) return;
  const next =
    (selectedIndex.value + delta + images.value.length) % images.value.length;
  selectedIndex.value = next;
  selectedImage.value = images.value[next];
};

const onUpdateDescription = async (id: string, description: string) => {
  if (!ensureAdminPermission()) return;
  await updateDescription(id, description);
};

const onDeleteImage = async (id: string) => {
  if (!ensureAdminPermission()) return;
  const removed = await deleteImage(id);
  if (removed) {
    selectedIds.value.delete(id);
    selectedIds.value = new Set(selectedIds.value);
    generateLayoutSeeds();
    closeImageDetail();
  }
};

const onImageUploaded = async (image: Picture) => {
  images.value.push(image);
  await saveGallery();
  generateLayoutSeeds();
};

onMounted(async () => {
  await fetchGalleryImages();
  generateLayoutSeeds();
});
</script>

<style scoped>
/* ============================================================
   瀑布流布局：纯 CSS multi-column
   - columns 控制列数，column-gap 控制列间水平间距
   - gallery-item 的 margin-bottom 提供列内垂直间距，break-inside: avoid 防止卡片被拆断
   - gallery-empty 用 column-span: all 占满整行
   - 响应式列数与间距通过 CSS 变量集中管理
   - 卡片在组件内已通过 aspect-ratio 预留高度，加载无跳动
   ============================================================ */

.gallery-masonry {
  /* 间距：小屏 10px，≥640px 14px */
  --gallery-gap: 10px;
  /* 列数响应式：<480→2, <768→3, <1100→4, <1400→5, ≥1400→6 */
  --gallery-cols: 2;

  columns: var(--gallery-cols);
  column-gap: var(--gallery-gap);
}

.gallery-item {
  break-inside: avoid;
  margin-bottom: var(--gallery-gap);
}

.gallery-empty {
  /* 空状态占满整行 */
  column-span: all;
}

/* 响应式列数与间距 */
@media (min-width: 480px) {
  .gallery-masonry {
    --gallery-cols: 3;
  }
}

@media (min-width: 640px) {
  .gallery-masonry {
    --gallery-gap: 14px;
  }
}

@media (min-width: 768px) {
  .gallery-masonry {
    --gallery-cols: 4;
  }
}

@media (min-width: 1100px) {
  .gallery-masonry {
    --gallery-cols: 5;
  }
}

@media (min-width: 1400px) {
  .gallery-masonry {
    --gallery-cols: 6;
  }
}

@media (prefers-reduced-motion: reduce) {
  .gallery-item {
    animation: none;
  }
}
</style>
