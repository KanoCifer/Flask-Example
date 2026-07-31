<template>
  <Teleport to="body">
    <div
      v-if="image"
      class="fixed inset-0 z-9999 flex flex-col bg-black/85 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdm-title"
      @click.self="$emit('close')"
      @keydown.esc="$emit('close')"
      tabindex="-1"
    >
      <!-- ──── Top bar: close + frame counter ──── -->
      <header
        class="absolute top-0 right-0 left-0 z-20 flex items-center justify-between px-6 py-5 text-white/70"
      >
        <span
          v-if="frameNo"
          class="text-[11px] tracking-[0.2em] uppercase tabular-nums"
          style="font-family: var(--font-mono)"
        >
          {{ frameNo }} / {{ totalFrames }}
        </span>
        <span v-else />
        <button
          type="button"
          class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/80 transition-colors hover:border-white/40 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
          aria-label="关闭详情"
          @click="$emit('close')"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M6 18L18 6" />
          </svg>
        </button>
      </header>

      <!-- ──── Photo stage: native aspect, fills available viewport ──── -->
      <div
        class="relative flex min-h-0 flex-1 items-center justify-center px-6 pt-20 pb-6"
        @click.self="$emit('close')"
      >
        <!-- Prev / Next chevrons, hugging the edges -->
        <button
          type="button"
          class="absolute top-1/2 left-4 z-10 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white/80 backdrop-blur-sm transition-all hover:scale-105 hover:border-white/40 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
          aria-label="上一张"
          @click="$emit('prev')"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          class="absolute top-1/2 right-4 z-10 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white/80 backdrop-blur-sm transition-all hover:scale-105 hover:border-white/40 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
          aria-label="下一张"
          @click="$emit('next')"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>

        <motion.img
          :key="image.id"
          :src="image.mediumUrl ?? image.url"
          :alt="image.description || ''"
          :initial="{ opacity: 0, scale: 0.985 }"
          :animate="{ opacity: 1, scale: 1 }"
          :exit="{ opacity: 0, scale: 0.985 }"
          :transition="{
            type: 'spring',
            damping: 30,
            stiffness: 280,
            mass: 0.8,
          }"
          class="max-h-full max-w-full object-contain select-none"
          :style="imageStyle"
          draggable="false"
        />
      </div>

      <!-- ──── Bottom info strip: EXIF + caption + edit form ──── -->
      <footer
        class="relative z-10 mx-auto w-full max-w-6xl px-6 pt-3 pb-6 text-white/90"
      >
        <!-- ── 编辑态：描述 + 上传时间 + EXIF 全量表单 ── -->
        <div
          v-if="editable && isEditing"
          class="max-h-[46vh] space-y-5 overflow-y-auto rounded-2xl border border-white/10 bg-white/5 p-5"
          role="group"
          aria-label="编辑图片信息"
        >
          <div class="flex items-start justify-between gap-6">
            <div class="min-w-0 flex-1">
              <label
                class="mb-1.5 block text-[11px] tracking-[0.14em] text-white/45 uppercase"
                style="font-family: var(--font-mono)"
              >
                拍摄笔记
              </label>
              <textarea
                ref="captionEditEl"
                v-model="localDescription"
                rows="2"
                aria-label="编辑拍摄笔记"
                class="w-full resize-none border-b border-white/15 bg-transparent pb-1 text-[14px] leading-[1.6] text-white placeholder:text-white/35 focus:border-white/40 focus:outline-none"
                placeholder="写下这一刻..."
                @keydown.esc="toggleEdit"
              ></textarea>
            </div>
            <div class="flex shrink-0 items-center gap-2 pt-6">
              <button
                type="button"
                class="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3 text-[12px] font-medium text-black transition-colors hover:bg-white/90"
                aria-label="保存对图片信息的修改"
                @click="onSave"
              >
                保存
              </button>
              <button
                type="button"
                class="inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-[12px] text-white/50 transition-colors hover:text-white"
                aria-label="删除此图片"
                @click="$emit('delete', image.id)"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <path
                    d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <div>
              <label
                class="mb-1.5 block text-[11px] tracking-[0.14em] text-white/45 uppercase"
                style="font-family: var(--font-mono)"
              >
                上传时间
              </label>
              <input
                v-model="localUploadedAt"
                type="datetime-local"
                aria-label="上传时间"
                class="w-full rounded-lg border border-white/15 bg-transparent px-3 py-1.5 text-[13px] text-white focus:border-white/40 focus:outline-none"
              />
            </div>
            <template v-for="field in exifEditFields" :key="field.key">
              <div>
                <label
                  class="mb-1.5 block text-[11px] tracking-[0.14em] text-white/45 uppercase"
                  style="font-family: var(--font-mono)"
                >
                  {{ field.label }}
                </label>
                <input
                  v-model="localExif[field.key]"
                  type="text"
                  :aria-label="field.label"
                  class="w-full rounded-lg border border-white/15 bg-transparent px-3 py-1.5 text-[13px] text-white focus:border-white/40 focus:outline-none"
                />
              </div>
            </template>
            <div>
              <label
                class="mb-1.5 block text-[11px] tracking-[0.14em] text-white/45 uppercase"
                style="font-family: var(--font-mono)"
              >
                纬度 (GPS)
              </label>
              <input
                v-model="localGpsLat"
                type="number"
                step="any"
                aria-label="纬度"
                placeholder="31.23"
                class="w-full rounded-lg border border-white/15 bg-transparent px-3 py-1.5 text-[13px] text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
              />
            </div>
            <div>
              <label
                class="mb-1.5 block text-[11px] tracking-[0.14em] text-white/45 uppercase"
                style="font-family: var(--font-mono)"
              >
                经度 (GPS)
              </label>
              <input
                v-model="localGpsLng"
                type="number"
                step="any"
                aria-label="经度"
                placeholder="121.47"
                class="w-full rounded-lg border border-white/15 bg-transparent px-3 py-1.5 text-[13px] text-white placeholder:text-white/30 focus:border-white/40 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <!-- ── 非编辑态：只读展示 ── -->
        <template v-else>
          <!-- EXIF strip — one line, monospaced, only filled fields -->
          <div
            v-if="hasExif"
            class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] tracking-[0.14em] text-white/55 uppercase tabular-nums"
            style="font-family: var(--font-mono)"
            aria-label="拍摄参数"
          >
            <template v-for="(item, i) in exifItems" :key="item.label">
              <span v-if="i > 0" class="text-white/20" aria-hidden="true">·</span>
              <span class="flex items-center gap-1.5">
                <span class="text-white/40">{{ item.label }}</span>
                <span class="text-white/80">{{ item.value }}</span>
              </span>
            </template>
          </div>

          <!-- Caption -->
          <div class="flex items-end justify-between gap-6">
            <div class="min-w-0 flex-1">
              <h2
                v-if="titleLine"
                id="pdm-title"
                class="mb-1 text-[13px] tracking-[0.04em] text-white/85 tabular-nums"
                style="font-family: var(--font-mono)"
              >
                {{ titleLine }}
              </h2>
              <p
                v-if="!isEmpty"
                class="line-clamp-2 text-[14px] leading-[1.6] whitespace-pre-wrap text-white/80"
              >
                {{ image.description }}
              </p>
              <p v-else-if="!editable" class="text-[14px] text-white/35 italic">
                这一刻还没留下文字
              </p>
            </div>

            <!-- Action cluster: edit / delete -->
            <div class="flex shrink-0 items-center gap-2">
              <button
                v-if="editable"
                type="button"
                class="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 px-3 text-[12px] text-white/60 transition-colors hover:border-white/40 hover:text-white"
                aria-label="编辑图片信息"
                @click="toggleEdit"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <path
                    d="M12 20h9M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z"
                  />
                </svg>
                编辑
              </button>
              <button
                v-if="editable"
                type="button"
                class="inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-[12px] text-white/50 transition-colors hover:text-white"
                aria-label="删除此图片"
                @click="$emit('delete', image.id)"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="h-3.5 w-3.5"
                  aria-hidden="true"
                >
                  <path
                    d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14"
                  />
                </svg>
              </button>
            </div>
          </div>
        </template>
      </footer>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { motion } from 'motion-v';
import dayjs from 'dayjs';
import { computed, nextTick, ref, watch } from 'vue';
import type { ExifInfo, GalleryImage, UpdateImagePayload } from '@readinglist/api';

const props = defineProps<{
  image: GalleryImage | null;
  editable: boolean;
  formattedDate: string;
  frameNo?: number;
  exif?: ExifInfo | null;
}>();

const emit = defineEmits<{
  close: [];
  update: [id: string, partial: UpdateImagePayload];
  delete: [id: string];
  prev: [];
  next: [];
}>();

const localDescription = ref('');
const isEditing = ref(false);
const captionEditEl = ref<HTMLTextAreaElement | null>(null);
const localUploadedAt = ref('');
const localExif = ref<Record<string, string>>({});
const localGpsLat = ref('');
const localGpsLng = ref('');

const totalFrames = 36;

// 可编辑 EXIF 键 —— 仅渲染当前 exif 中已有的键（缺则不渲染对应输入）
const EXIF_EDIT_KEYS = [
  { key: 'camera', label: '相机' },
  { key: 'lens', label: '镜头' },
  { key: 'focalLength', label: '焦距 (mm)' },
  { key: 'focalLength35', label: '等效焦距 (mm)' },
  { key: 'aperture', label: '光圈' },
  { key: 'exposure', label: '快门' },
  { key: 'iso', label: 'ISO' },
  { key: 'takenAt', label: '拍摄时间' },
] as const;

const exifEditFields = computed(() =>
  EXIF_EDIT_KEYS.filter((f) => localExif.value[f.key] !== undefined),
);

// ISO 字符串 → datetime-local 值（YYYY-MM-DDTHH:mm）
const toDatetimeLocal = (iso?: string) => {
  if (!iso) return '';
  const d = dayjs(iso);
  return d.isValid() ? d.format('YYYY-MM-DDTHH:mm') : '';
};

const initForm = (img: GalleryImage | null) => {
  localDescription.value = img?.description ?? '';
  localUploadedAt.value = toDatetimeLocal(img?.uploadedAt);
  const src = (img?.exif ?? {}) as Record<string, unknown>;
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(src)) {
    if (k === 'gps' || v == null) continue;
    next[k] = String(v);
  }
  localExif.value = next;
  const gps = (src as { gps?: unknown }).gps;
  if (typeof gps === 'string') {
    const [lat, lng] = gps.split(',');
    localGpsLat.value = lat ?? '';
    localGpsLng.value = lng ?? '';
  } else if (gps && typeof gps === 'object') {
    const g = gps as { lat?: unknown; lng?: unknown };
    localGpsLat.value = g.lat != null ? String(g.lat) : '';
    localGpsLng.value = g.lng != null ? String(g.lng) : '';
  } else {
    localGpsLat.value = '';
    localGpsLng.value = '';
  }
  isEditing.value = false;
};

watch(() => props.image, initForm, { immediate: true });

const isEmpty = computed(() => !props.image?.description?.trim());
const ex = computed<ExifInfo>(() => props.exif ?? {});

// 拍摄时间：优先 EXIF takenAt, 回退到上传时间(由父级 formatDate 处理)
const takenAtDisplay = computed(() => {
  const raw = ex.value.takenAt;
  if (raw) {
    const m = /^(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2})/.exec(raw);
    if (m) return `${m[1]}.${m[2]}.${m[3]} ${m[4]}:${m[5]}`;
  }
  return props.formattedDate;
});

// 标题：相机型号 + 拍摄时间(同行),任一缺失则只显示存在的
const titleLine = computed(() => {
  const cam = ex.value.camera;
  const date = takenAtDisplay.value;
  if (cam && date) return `${cam} · ${date}`;
  return cam || date || '';
});

// 单行 EXIF 项 —— 只渲染有值的字段
interface ExifItem {
  label: string;
  value: string;
}
const exifItems = computed<ExifItem[]>(() => {
  const items: ExifItem[] = [];
  if (ex.value.lens) items.push({ label: '镜头', value: ex.value.lens });
  if (ex.value.focalLength35 || ex.value.focalLength) {
    items.push({
      label: '焦距',
      value: `${ex.value.focalLength35 || ex.value.focalLength}mm`,
    });
  }
  if (ex.value.aperture)
    items.push({ label: '光圈', value: ex.value.aperture });
  if (ex.value.exposure)
    items.push({ label: '快门', value: ex.value.exposure });
  if (ex.value.iso != null)
    items.push({ label: 'ISO', value: String(ex.value.iso) });
  if (ex.value.gps) {
    const fmt = (v: number, pos: string, neg: string) =>
      `${Math.abs(v).toFixed(2)}°${v >= 0 ? pos : neg}`;
    items.push({
      label: '地点',
      value: `${fmt(ex.value.gps.lat, 'N', 'S')} ${fmt(ex.value.gps.lng, 'E', 'W')}`,
    });
  }
  // EXIF 拍摄时间作为独立项,只在与上传时间不同时显示(否则标题里已含)
  if (ex.value.takenAt) {
    const m = /^(\d{4}):(\d{2}):(\d{2})/.exec(ex.value.takenAt);
    if (m) items.push({ label: '拍摄', value: `${m[1]}.${m[2]}.${m[3]}` });
  }
  return items;
});

const hasExif = computed(() => exifItems.value.length > 0);

// 图片渲染样式 —— 当原图宽高已知时锁定原生 aspect-ratio，避免被拉伸
const imageStyle = computed(() => {
  const img = props.image;
  if (img?.width && img?.height && img.height > 0) {
    return { aspectRatio: `${img.width} / ${img.height}` };
  }
  // 兜底：不做 aspect 假设，让浏览器按 max-h/max-w 自适应
  return {};
});

async function toggleEdit() {
  isEditing.value = !isEditing.value;
  if (isEditing.value) {
    await nextTick();
    captionEditEl.value?.focus();
  }
}

function onSave() {
  if (!props.image || !props.editable || !isEditing.value) return;
  const exif: Record<string, string> = { ...localExif.value };
  // 去掉被清空的字段，避免把空字符串写库
  for (const k of Object.keys(exif)) {
    if (exif[k] === '') delete exif[k];
  }
  if (localGpsLat.value !== '' && localGpsLng.value !== '') {
    exif.gps = `${localGpsLat.value},${localGpsLng.value}`;
  }
  const uploadedAt = localUploadedAt.value
    ? new Date(localUploadedAt.value).toISOString()
    : null;
  emit('update', props.image.id, {
    description: localDescription.value,
    uploadedAt,
    exif: Object.keys(exif).length > 0 ? exif : null,
  });
  isEditing.value = false;
}
</script>

<style scoped>
/* Modal container has no decorations — just a calm dark backdrop.
   The photo and the EXIF/caption strip carry the entire visual weight. */
</style>
