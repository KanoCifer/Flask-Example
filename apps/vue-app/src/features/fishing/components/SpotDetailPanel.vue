<script setup lang="ts">
/**
 * SpotDetailPanel —— 钓点详情(悬浮圆角卡片)。
 *
 * 取代原 FishingSpotDetailModal(420px 小弹窗),对齐 SettingsModal 书房纸卡风格:
 * 右侧浮动(mx-4 my-6 呼吸边)、rounded-3xl、四层 color-mix 阴影(顶反光),
 * 不模糊背景,仅 × 按钮关闭(点击mask不关闭)。
 * 详情为阅读节奏服务 —— serif 正文 + 照片墙 + 迷你地图。
 *
 * 数据流:FishingSpot 经 toMapMarker 拆为 position + extraData,
 * 本组件同时消费两者(详情字段 + 迷你地图 / 路线规划都需要)。
 */
import {
  ConfirmDialog,
  Button as UiButton,
  SlideFadeTransitionX,
} from '@/components';
import SpotMiniMap from '@/features/fishing/components/SpotMiniMap.vue';
import SpotPhotoLightbox from '@/features/fishing/components/SpotPhotoLightbox.vue';
import type { MapMarker } from '@/features/fishing/types';
import type { SpotDetail } from '@/features/fishing/types';
import type { UpdateFishingSpotPayload } from '@/features/fishing/api';
import { fishingSpotsGateway } from '@/features/fishing/api';
import { useUpload } from '@/features/upload/composables';
import { UploadDropzone, UploadProgress } from '@/features/upload/components';
import { rewriteMediaUrl } from '@/composables';
import { useNotificationStore } from '@/stores';
import {
  ImageOff,
  ImagePlus,
  Loader2,
  MapPin,
  Navigation,
  Pencil,
  RefreshCw,
  Star,
  Trash2,
  X,
} from '@lucide/vue';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';
import { computed, nextTick, ref, watch } from 'vue';

/*
 * 卡片阴影 —— 三层向右 ambient + 顶部 inset 纸面反光。
 * color-mix 让明暗主题自动追踪,遵守 No-Fixed-RGBA Rule。
 * inline style 覆盖全局 :where([class~='border']) 的硬阴影。
 */
const CARD_SHADOW = [
  '0 -1px 1px color-mix(in oklch, var(--ink) 6%, transparent)',
  '0 -8px 18px color-mix(in oklch, var(--ink) 8%, transparent)',
  '0 -24px 40px color-mix(in oklch, var(--ink) 5%, transparent)',
  'inset 0 1px 0 0 oklch(from var(--page) l c h / 0.6)',
].join(', ');

const props = defineProps<{
  open: boolean;
  /** 完整 MapMarker: extraData 供详情展示,position 供迷你地图 / 路线规划 */
  marker: MapMarker | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'route', marker: MapMarker): void;
  /** 钓点被删除后通知父组件同步地图标记 */
  (e: 'spot-deleted', id: string): void;
  /** 钓点字段更新后通知父组件同步 */
  (e: 'spot-updated', marker: MapMarker): void;
}>();

// ── 派生:详情字段(与旧 modal SpotDetail 同结构) ──
const spot = computed<SpotDetail | undefined>(() => props.marker?.extraData);
const position = computed<[number, number] | undefined>(
  () => props.marker?.position,
);

// ── 日期文案 ──
const dateLabel = computed(() => {
  const created = spot.value?.created_at;
  if (!created) return '';
  const updated = spot.value?.updated_at;
  const base = `记于 ${dayjs(created).format('YYYY-MM-DD')}`;
  if (updated && updated !== created) {
    return `${base} · 更新于 ${dayjs(updated).format('YYYY-MM-DD')}`;
  }
  return base;
});

// ── 照片墙 ──
const lightboxOpen = ref(false);
const photoIndex = ref(0);
function openLightbox(i: number): void {
  photoIndex.value = i;
  lightboxOpen.value = true;
}

// ── 路线 ──
function onRoute(): void {
  if (props.marker) emit('route', props.marker);
}

// ── 编辑模式 ──
const editing = ref(false);
const editName = ref('');
const editDescription = ref('');
const editTags = ref('');
const editRating = ref(0);
const saving = ref(false);

// ── 编辑模式 · 图片上传 ──
// 与 SpotFormPanel 同套交互(最多 9 张,5MB,串行上传),但还要叠加「保留/移除已有图片」。
// 引入 isExisting 标记,save 时把整张列表提交,后端按整列替换语义覆盖。
interface EditPicture {
  id: string;
  url: string;
  uploadedAt: string;
  description: string;
  isExisting: boolean;
}
const MAX_PICTURES = 9;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const editPictures = ref<EditPicture[]>([]);
const pendingError = ref<string | null>(null);

const { upload, isUploading, progress } = useUpload({
  type: 'gallery',
  maxSize: MAX_UPLOAD_BYTES,
  allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
});

// 文件选择 / 预览状态
const fileInputRef = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const previewUrl = ref<string | null>(null);
const isDragging = ref(false);

const triggerFileInput = () => fileInputRef.value?.click();

const processFile = (file: File) => {
  if (!file.type.startsWith('image/')) {
    useNotificationStore().error('请选择图片文件');
    return;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    useNotificationStore().error('图片大小不能超过 5MB');
    return;
  }
  selectedFile.value = file;
  previewUrl.value = URL.createObjectURL(file);
};

const handleFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    processFile(target.files[0]);
  }
};

const handleDrop = (event: DragEvent) => {
  isDragging.value = false;
  if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
    processFile(event.dataTransfer.files[0]);
  }
};

const handleDropzoneSelect = (files: File[]) => {
  const f = files[0];
  if (f) processFile(f);
};

watch(previewUrl, (_, prev) => {
  if (prev) URL.revokeObjectURL(prev);
});

const canAddMore = computed(() => editPictures.value.length < MAX_PICTURES);

function resetEditPictures(): void {
  editPictures.value = [];
  pendingError.value = null;
  selectedFile.value = null;
  previewUrl.value = null;
}

function startEdit(): void {
  editName.value = spot.value?.name ?? '';
  editDescription.value = spot.value?.description ?? '';
  editTags.value = (spot.value?.tags ?? []).join(', ');
  editRating.value = spot.value?.rating ?? 0;
  editPictures.value = (spot.value?.images ?? []).map((url) => ({
    id: uuidv4().slice(0, 8),
    url,
    uploadedAt: '',
    description: '',
    isExisting: true,
  }));
  pendingError.value = null;
  selectedFile.value = null;
  previewUrl.value = null;
  editing.value = true;
}

function cancelEdit(): void {
  resetEditPictures();
  editing.value = false;
}

async function saveEdit(): Promise<void> {
  if (!spot.value) return;
  saving.value = true;
  try {
    const tags = editTags.value
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const images = editPictures.value.map((p) => p.url);
    const payload: UpdateFishingSpotPayload = {
      name: editName.value.trim(),
      description: editDescription.value.trim(),
      tags,
      rating: editRating.value,
      images,
    };
    await fishingSpotsGateway.update(spot.value.id, payload);
    editing.value = false;
    // 通知父组件同步 marker.extraData
    const updated: MapMarker = {
      ...props.marker!,
      extraData: {
        ...spot.value,
        ...payload,
        tags,
        images,
        updated_at: new Date().toISOString(),
      },
    };
    emit('spot-updated', updated);
    // 提交成功后再清理临时预览/upload 状态;editPictures 列表本身已固化到 spot.images
    resetEditPictures();
  } catch (err: unknown) {
    useNotificationStore().error(
      err instanceof Error ? err.message : '更新钓点失败',
    );
  } finally {
    saving.value = false;
  }
}

// ── 上传流:选中文件后立刻触发 upload(串行) ──
watch(selectedFile, async (file) => {
  if (!file) return;
  if (!canAddMore.value) {
    selectedFile.value = null;
    previewUrl.value = null;
    return;
  }
  pendingError.value = null;
  try {
    const url = await upload(file);
    editPictures.value.push({
      id: uuidv4().slice(0, 8),
      uploadedAt: dayjs().toISOString(),
      url: rewriteMediaUrl(url),
      description: '',
      isExisting: false,
    });
    selectedFile.value = null;
    previewUrl.value = null;
  } catch {
    pendingError.value = '图片上传失败,请重试';
  }
});

async function retryUpload(): Promise<void> {
  if (!selectedFile.value || isUploading.value) return;
  pendingError.value = null;
  try {
    const url = await upload(selectedFile.value);
    editPictures.value.push({
      id: uuidv4().slice(0, 8),
      uploadedAt: dayjs().toISOString(),
      url: rewriteMediaUrl(url),
      description: '',
      isExisting: false,
    });
    selectedFile.value = null;
    previewUrl.value = null;
  } catch {
    pendingError.value = '图片上传失败,请重试';
  }
}

function removePicture(p: EditPicture): void {
  editPictures.value = editPictures.value.filter((x) => x.id !== p.id);
}

function removeFailed(): void {
  selectedFile.value = null;
  previewUrl.value = null;
  pendingError.value = null;
}

function onPickerChange(event: Event): void {
  handleFileSelect(event);
  (event.target as HTMLInputElement).value = '';
}

// ── 删除 ──
const deleteOpen = ref(false);
const deleting = ref(false);

function confirmDelete(): void {
  deleteOpen.value = true;
}

async function doDelete(): Promise<void> {
  if (!spot.value) return;
  deleting.value = true;
  try {
    await fishingSpotsGateway.remove(spot.value.id);
    deleteOpen.value = false;
    emit('spot-deleted', spot.value.id);
    emit('close');
  } catch (err) {
    console.error('删除钓点失败:', err);
  } finally {
    deleting.value = false;
  }
}

// ── 无障碍:focus trap + Esc + restore focus ──
const panelRef = ref<HTMLElement | null>(null);
let triggerEl: HTMLElement | null = null;
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function trapFocus(e: KeyboardEvent): void {
  if (e.key !== 'Tab' || !panelRef.value) return;
  const nodes = panelRef.value.querySelectorAll<HTMLElement>(FOCUSABLE);
  if (nodes.length === 0) return;
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      triggerEl = (document.activeElement as HTMLElement) ?? null;
      editing.value = false;
      await nextTick();
      const first = panelRef.value?.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus();
    } else {
      triggerEl?.focus();
      triggerEl = null;
    }
  },
);
</script>

<template>
  <Teleport to="body">
    <!--
      钓点详情 —— 悬浮圆角卡片(对齐 SettingsModal 书房纸卡风格)。
      · 右侧浮动,mx-4 my-6 留出呼吸边,rounded-3xl 家具感
      · 四层 color-mix 阴影(右 + 顶反光),遵守 No-Fixed-RGBA Rule
      · 无背景模糊;点击遮罩不关闭(仅 × 按钮关闭)
    -->

    <SlideFadeTransitionX>
      <aside
        v-if="open"
        ref="panelRef"
        class="bg-page border-border fixed top-6 right-6 bottom-6 z-50 flex w-full max-w-[480px] flex-col overflow-hidden rounded-3xl border"
        :style="CARD_SHADOW"
        role="dialog"
        aria-modal="true"
        aria-label="钓点详情"
        @keydown="trapFocus"
        @keydown.esc="emit('close')"
      >
        <!-- 顶栏 -->
        <header
          class="border-border flex items-start justify-between gap-3 border-b px-6 pt-6 pb-5"
        >
          <div class="min-w-0 space-y-1.5">
            <!-- 名称 -->
            <h2
              class="text-ink font-family-averia truncate text-2xl leading-snug"
            >
              {{ spot?.name || '未命名钓点' }}
            </h2>
            <!-- 评分 -->
            <div
              v-if="(spot?.rating ?? 0) > 0"
              class="flex items-center gap-1.5"
            >
              <div class="text-warning flex items-center" aria-hidden="true">
                <Star
                  v-for="i in 5"
                  :key="i"
                  class="h-4 w-4"
                  :class="
                    i <= Math.round(spot!.rating)
                      ? 'fill-warning'
                      : 'text-muted/30'
                  "
                />
              </div>
              <span class="text-ink text-xs tabular-nums">
                {{ spot!.rating.toFixed(1) }}
              </span>
            </div>
          </div>
          <button
            type="button"
            class="text-muted hover:bg-surface hover:text-ink inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors"
            aria-label="关闭详情"
            @click="emit('close')"
          >
            <X class="h-4 w-4" />
          </button>
        </header>

        <!-- 可滚动主体 -->
        <div class="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <!-- 标签 -->
          <ul v-if="spot?.tags.length" class="flex flex-wrap gap-1.5">
            <li
              v-for="tag in spot.tags"
              :key="tag"
              class="bg-secondary text-ink rounded-full px-2.5 py-0.5 text-[11px] tracking-wide"
            >
              {{ tag }}
            </li>
          </ul>

          <!-- 日期 -->
          <p v-if="dateLabel" class="text-muted text-xs">
            {{ dateLabel }}
          </p>

          <!-- 编辑模式 -->
          <div v-if="editing" class="space-y-4">
            <div>
              <label
                class="text-ink mb-1.5 block text-sm font-medium"
                for="edit-name"
                >名称</label
              >
              <input
                id="edit-name"
                v-model="editName"
                type="text"
                class="bg-surface text-ink focus:ring-accent/30 w-full rounded-xl border-0 px-4 py-3 text-sm focus:ring-2 focus:outline-none"
              />
            </div>
            <div>
              <label
                class="text-ink mb-1.5 block text-sm font-medium"
                for="edit-desc"
                >描述</label
              >
              <textarea
                id="edit-desc"
                v-model="editDescription"
                rows="4"
                class="bg-surface text-ink focus:ring-accent/30 w-full resize-none rounded-xl border-0 px-4 py-3 text-sm leading-relaxed focus:ring-2 focus:outline-none"
              />
            </div>
            <div>
              <label
                class="text-ink mb-1.5 block text-sm font-medium"
                for="edit-tags"
                >标签(逗号分隔)</label
              >
              <input
                id="edit-tags"
                v-model="editTags"
                type="text"
                class="bg-surface text-ink focus:ring-accent/30 w-full rounded-xl border-0 px-4 py-3 text-sm focus:ring-2 focus:outline-none"
              />
            </div>
            <div>
              <label class="text-ink mb-1.5 block text-sm font-medium"
                >评分</label
              >
              <div class="flex items-center gap-1">
                <button
                  v-for="i in 5"
                  :key="i"
                  type="button"
                  class="p-0.5"
                  :aria-label="`${i} 星`"
                  @click="editRating = i"
                >
                  <Star
                    class="h-5 w-5"
                    :class="
                      i <= editRating
                        ? 'fill-warning text-warning'
                        : 'text-muted/30'
                    "
                  />
                </button>
                <span class="text-muted ml-2 text-xs tabular-nums">
                  {{ editRating.toFixed(1) }}
                </span>
              </div>
            </div>

            <!-- 图片(编辑:已上传 + 新增,最多 9 张) -->
            <div>
              <span class="text-ink mb-1.5 block text-sm font-medium"
                >图片</span
              >

              <!-- 隐藏 file input:由 + 瓦片 click() 触发(空态改用 UploadDropzone 自管 input) -->
              <input
                ref="fileInputRef"
                type="file"
                accept="image/*"
                class="hidden"
                @change="onPickerChange"
              />

              <!-- 空态:通用 UploadDropzone -->
              <UploadDropzone
                v-if="
                  editPictures.length === 0 &&
                  !previewUrl &&
                  !spot?.images.length
                "
                accept="image/*"
                :disabled="isUploading"
                prompt="点击或拖拽图片到此处"
                :hint="`最多 ${MAX_PICTURES} 张,单张 ≤5MB`"
                @select="handleDropzoneSelect"
              />

              <!-- 非空态:3 列缩略图网格(已有 + 新增 + 在传 + +瓦片) -->
              <div v-else class="grid grid-cols-3 gap-2">
                <!-- 已有 / 新增图片(均支持移除) -->
                <div
                  v-for="p in editPictures"
                  :key="p.id"
                  class="group bg-surface relative aspect-square overflow-hidden rounded-xl"
                  :class="{ 'opacity-60': !p.isExisting && !pendingError }"
                >
                  <img :src="p.url" alt="" class="h-full w-full object-cover" />
                  <button
                    type="button"
                    class="bg-page/80 text-ink hover:bg-page absolute top-1.5 right-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full opacity-0 shadow-sm backdrop-blur-md transition-opacity group-hover:opacity-100"
                    :aria-label="p.isExisting ? '移除旧图片' : '移除新图片'"
                    @click="removePicture(p)"
                  >
                    <X class="h-3.5 w-3.5" />
                  </button>
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
                    <p
                      class="text-destructive text-xs leading-tight font-medium"
                    >
                      {{ pendingError }}
                    </p>
                    <div class="flex gap-1.5">
                      <button
                        type="button"
                        class="bg-accent text-ink hover:bg-accent/90 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium"
                        @click="retryUpload"
                      >
                        <RefreshCw class="h-3 w-3" />
                        重试
                      </button>
                      <button
                        type="button"
                        class="bg-surface text-ink hover:bg-surface/70 rounded-md px-2 py-1 text-xs font-medium"
                        @click="removeFailed"
                      >
                        移除
                      </button>
                    </div>
                  </div>
                </div>

                <!-- + 瓦片 -->
                <button
                  v-if="canAddMore && !previewUrl"
                  type="button"
                  class="bg-surface hover:bg-surface/70 group relative aspect-square overflow-hidden rounded-xl border-2 border-dashed transition-colors"
                  :class="{ 'border-ink': isDragging }"
                  :aria-label="'添加图片'"
                  :title="`还可上传 ${MAX_PICTURES - editPictures.length} 张`"
                  @click="triggerFileInput"
                  @dragover.prevent
                  @dragleave.prevent="isDragging = false"
                  @drop.prevent="handleDrop"
                >
                  <div
                    class="absolute inset-0 flex flex-col items-center justify-center"
                  >
                    <ImagePlus
                      class="text-muted group-hover:text-ink h-5 w-5 transition-colors"
                      :stroke-width="1.5"
                    />
                    <span class="text-muted mt-1 text-xs">添加</span>
                  </div>
                </button>
              </div>

              <p class="text-muted mt-1.5 text-xs tabular-nums">
                {{ editPictures.length }} / {{ MAX_PICTURES }}
              </p>
            </div>

            <div class="flex items-center gap-2 pt-1">
              <button
                type="button"
                class="text-muted hover:bg-surface rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                :disabled="saving || isUploading"
                @click="cancelEdit"
              >
                取消
              </button>
              <UiButton
                size="sm"
                type="button"
                :disabled="saving || isUploading"
                @click="saveEdit"
              >
                {{ saving ? '保存中...' : '保存' }}
              </UiButton>
            </div>
          </div>

          <!-- 描述 -->
          <div v-else>
            <p
              v-if="spot?.description"
              class="text-ink/85 font-serif text-[15px] leading-[1.7] text-pretty"
            >
              {{ spot.description }}
            </p>
            <p v-else class="text-muted text-sm text-pretty italic">
              钓点描述暂无 —— 出钓一次,把体验写进 feedback 里。
            </p>
          </div>

          <!-- 照片墙 -->
          <div v-if="spot?.images.length" class="grid grid-cols-2 gap-2">
            <button
              v-for="(img, i) in spot.images"
              :key="i"
              type="button"
              class="group /30 relative block overflow-hidden rounded-xl border"
              @click="openLightbox(i)"
            >
              <img
                :src="img"
                :alt="`${spot.name} 图片 ${i + 1}`"
                class="h-36 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
            </button>
          </div>
          <p v-else class="text-muted text-sm italic">
            还没有照片 —— 下次出钓带上相机。
          </p>

          <!-- 迷你地图 -->
          <div v-if="position">
            <div class="text-muted mb-2 flex items-center gap-1.5">
              <MapPin class="h-3.5 w-3.5" />
              <span class="text-xs">位置</span>
            </div>
            <SpotMiniMap :position="position" :name="spot?.name ?? ''" />
          </div>
        </div>

        <!-- 底栏 -->
        <footer class="border-border space-y-3 border-t px-6 py-4">
          <!-- 主操作:规划路线 -->
          <UiButton class="w-full rounded-full! px-4 py-2.5" @click="onRoute">
            <Navigation class="h-4 w-4" />
            从这里规划路线
          </UiButton>
          <!-- 管理操作 -->
          <div class="flex items-center justify-end gap-1">
            <button
              v-if="!editing"
              type="button"
              class="text-muted hover:bg-surface hover:text-ink inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              @click="startEdit"
            >
              <Pencil class="h-3.5 w-3.5" />
              编辑
            </button>
            <button
              v-if="!editing"
              type="button"
              class="text-muted hover:bg-destructive/10 hover:text-destructive inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              @click="confirmDelete"
            >
              <Trash2 class="h-3.5 w-3.5" />
              删除
            </button>
          </div>
        </footer>
      </aside>
    </SlideFadeTransitionX>

    <!-- 照片灯箱 -->
    <SpotPhotoLightbox
      v-if="lightboxOpen && spot?.images.length"
      :images="spot.images"
      :index="photoIndex"
      :title="spot.name"
      @close="lightboxOpen = false"
      @update:index="photoIndex = $event"
    />

    <!-- 删除确认 -->
    <ConfirmDialog
      :open="deleteOpen"
      :title="`删除钓点「${spot?.name ?? ''}」?`"
      message="软删可在后端恢复;永久删除不可撤销。"
      confirm-text="删除"
      cancel-text="取消"
      variant="destructive"
      @close="deleteOpen = false"
      @confirm="doDelete"
    />

    <!-- 删除 loading 遮罩 -->
    <div
      v-if="deleting"
      class="bg-ink/30 fixed inset-0 z-[70] flex items-center justify-center backdrop-blur-sm"
    >
      <p class="text-page text-sm">删除中…</p>
    </div>
  </Teleport>
</template>
