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
      Gallery Container —— 多列瀑布流 (CSS columns)
      column-count:     列数,由 --gallery-cols 随断点递增
      break-inside:     avoid,卡片不被拆到两列
      卡片高度由图片 aspect-ratio 自然撑开,顺序纵向填充第一列→第二列→…
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
          :aspect="getCardAspect(index)"
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
      :editable="canEdit"
      :formatted-date="
        selectedImage ? formatDate(selectedImage.uploadedAt) : ''
      "
      :frame-no="selectedIndex + 1"
      :exif="selectedImage?.exif ?? undefined"
      @close="closeImageDetail"
      @update="onUpdateImage"
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
} from '@/features/pic/composables';
import type { GalleryImage, UpdateImagePayload } from '@readinglist/api';
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
  updateImage,
  deleteImage,
  formatDate,
} = useGallery();

const { generateLayoutSeeds, shuffleImages, getRotation, getCardAspect } =
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
const selectedImage = ref<GalleryImage | null>(null);
const selectedIndex = ref(-1);

const openImageDetail = (image: GalleryImage, index: number) => {
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

const onUpdateImage = async (id: string, partial: UpdateImagePayload) => {
  if (!ensureAdminPermission()) return;
  await updateImage(id, partial);
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

const onImageUploaded = async (image: GalleryImage) => {
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
   多列瀑布流 (CSS columns)
   - column-count: 列数;column-gap: 列间距(行间距由 item margin-bottom)
   - 卡片顺序纵向填充,第一列排满后进入下一列
   - break-inside: avoid 保证卡片不被拆到两列
   - 卡片高度由图片 aspect-ratio 自然撑开,无需手工计算
   - gallery-empty 用 column-span: all 跨满整行
   ============================================================ */

.gallery-masonry {
  /* --gallery-cols 决定列数,随断点递增 */
  --gallery-gap: 12px;
  --gallery-cols: 2;

  column-count: var(--gallery-cols);
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

/* 响应式列数 —— 与原版对齐:<480→2, <768→3, <1100→4, <1400→5, ≥1400→6 */
@media (min-width: 480px) {
  .gallery-masonry {
    --gallery-cols: 3;
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
