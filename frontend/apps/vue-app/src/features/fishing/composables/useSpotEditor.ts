/**
 * useSpotEditor —— 钓点新增/编辑态的双模式 seam。
 *
 * 职责：
 * - 统一维护「create」与「edit」两种模式下的 draft / pictures / pendingError / isEditing 状态。
 * - 把原本散在 SpotFormPanel 与 SpotDetailPanel 中的图片上传 pipeline
 *   (校验 → 预览 → 自动 upload → 失败重试) 集中到 seam,组件只做单向数据绑定。
 * - 与 useUpload 契约:调用方拿 upload / isUploading / progress,seam 负责串行上传串、blob URL 释放、
 *   allowedTypes + maxSize 校验、本地 9 张上限 —— 与原 SpotFormPanel 完全一致。
 *
 * 与现有结构的关系:
 * - 不依赖 useFishingMapStore / useNotificationStore —— store / toast 仍由组件层接入,
 *   seam 仅暴露 pendingError ref 供组件渲染。这样 seam 干净可测,组件保留视图层自治。
 * - draft 与 SpotDetailPanel.SpotFormPanel 字段一一对应(tags 用逗号字符串,
 *   提交时 split → trim → filter(Boolean) → tags: string[])。
 *
 * 模式差异:
 * - create: name/kind/coordinate 必填;coordinate 初始从 initialLocation 拿;pictures 初始空;editing 状态无意义。
 * - edit:   从 initial(SpotDetail)派生 name/description/tags/rating/kind;pictures 由 initial.images 推;
 *           editing 初始为 false;coordinate 始终 null(坐标编辑走其它 seam,本 seam 不接手)。
 */
import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

import { useUpload } from '@/features/upload/composables';
import type {
  CreateFishingSpotPayload,
  SpotEditorDraft,
  SpotPicture,
  SpotDetail,
  UpdateFishingSpotPayload,
} from '@readinglist/types';
import { SPOT_MAX_PICTURES, SPOT_MAX_UPLOAD_BYTES } from '@readinglist/types';

export interface UseSpotEditorOptions {
  /** 'create'：表单初始全空;coordinate 取 initialLocation | null。 */
  mode: 'create' | 'edit';
  /** edit 模式必填:从父组件传入当前选中 spot 的详情作为派生基底。 */
  initial?: SpotDetail;
  /** create 模式可选:地图选点初始坐标,create 模式下 draft.coordinate 起始值。 */
  initialLocation?: [number, number];
}

export interface UseSpotEditorReturn {
  /** 表单草稿 —— 模板双向绑定即可,seam 内部负责派生/重置。 */
  draft: Ref<SpotEditorDraft>;
  /** 图片条目 view-model(包含已选未上传预览外的"已上传条目")。 */
  pictures: Ref<SpotPicture[]>;
  /** 上传/校验失败的最近一条错误信息;组件按需 toast 或渲染。 */
  pendingError: Ref<string | null>;
  /** 上传进度相关 —— 解构自 useUpload,组件可直接绑 UI。 */
  isUploading: Ref<boolean>;
  progress: Ref<number>;
  /** 文件输入/预览状态 —— 文件选择 / 拖拽共用。 */
  selectedFile: Ref<File | null>;
  previewUrl: Ref<string | null>;
  isDragging: Ref<boolean>;
  fileInputRef: Ref<HTMLInputElement | null>;
  /** create 模式下必选;edit 模式下始终 false(后端 kind 可任意保留)。 */
  kindTouched: Ref<boolean>;
  /** 当前图张数 < 上限,可继续添加。 */
  canAddMore: ComputedRef<boolean>;
  /** 当前草稿是否可提交。模式相关:create 看 name/kind/coordinate,edit 仅看 name。 */
  canSubmit: ComputedRef<boolean>;
  /** 当前 draft 与 initial 差异 —— 仅 edit 模式有意义;create 模式恒 false。 */
  isDirty: ComputedRef<boolean>;
  /** edit 模式下标志位;create 模式下恒 false(包装一层 computed)。 */
  isEditing: ComputedRef<boolean>;
  /** 触发底层 <input type="file"> click。 */
  triggerFileInput: () => void;
  /** 同步处理单个文件:校验 → preview → 自动 upload。失败写入 pendingError。 */
  handleFile: (file: File) => Promise<void>;
  /** <input type="file" @change> 适配,取首个文件走 handleFile。 */
  handleFileSelect: (event: Event) => void;
  /** 拖拽适配,preventDefault + 取首个文件走 handleFile。 */
  handleDrop: (event: DragEvent) => void;
  /** UploadDropzone `@select` 适配:取首个文件走 handleFile(单文件模式)。 */
  handleDropzoneSelect: (files: File[]) => Promise<void>;
  /** 移除某张已上传图(同时清理 selectedFile/previewUrl 命中项)。 */
  removePicture: (p: SpotPicture) => void;
  /** 仅清理"上传中/失败"瓦片 —— selectedFile / previewUrl / pendingError 三件套。
   *  对应原组件 removeFailed(),失败瓦片点"移除"时调用。 */
  clearPreview: () => void;
  /** 重传:用当前 selectedFile 重新触发上传链。 */
  retryUpload: () => Promise<void>;
  /** 仅 edit 模式:进入编辑态(从 initial 派生 draft / pictures),设置 editing=true。 */
  startEdit: () => void;
  /** 仅 edit 模式:退出编辑态,清空临时状态。 */
  cancelEdit: () => void;
  /** 提交成功后的清理:create → 全清;edit → 退到只读(等同 cancelEdit)。 */
  resetAfterSubmit: () => void;
  /** 仅 edit 模式:marker 切换或外部刷新时,按新 initial 重派生 + 退到只读。 */
  resetFrom: (initial: SpotDetail) => void;
  /** 把当前 draft + pictures 拍平成后端 payload,模式决定字段集合。 */
  buildPayload: () => CreateFishingSpotPayload | UpdateFishingSpotPayload;
}

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export function useSpotEditor(
  options: UseSpotEditorOptions,
): UseSpotEditorReturn {
  const { mode, initial, initialLocation } = options;

  // ── 表单草稿 ──
  // create 模式:coordinate 初始取 initialLocation ?? null;
  // edit 模式:从 initial 派生,coordinate 始终 null(留空让其它 seam/组件决定)。
  const draft = ref<SpotEditorDraft>(
    mode === 'edit' && initial
      ? spotDetailToDraft(initial)
      : makeEmptyDraft(initialLocation),
  );
  // ── 图片列表 view-model ──
  const pictures = ref<SpotPicture[]>(
    mode === 'edit' && initial ? imagesToPictures(initial) : [],
  );
  // ── 当前派生基底 —— resetFrom 后更新,isDirty 据此重新比较 ──
  const baseDetail = ref<SpotDetail | null>(
    mode === 'edit' && initial ? initial : null,
  );
  const pendingError = ref<string | null>(null);

  // ── useUpload:与 SpotFormPanel / SpotDetailPanel 同样配置 ──
  const { upload, isUploading, progress } = useUpload({
    type: 'gallery',
    maxSize: SPOT_MAX_UPLOAD_BYTES,
    allowedTypes: [...ALLOWED_IMAGE_TYPES],
  });

  // ── 文件选择 / 预览 ──
  const fileInputRef = ref<HTMLInputElement | null>(null);
  const selectedFile = ref<File | null>(null);
  const previewUrl = ref<string | null>(null);
  const isDragging = ref(false);

  // 仅 create 模式使用,标记用户是否已与 kind 选择交互过(用于错误态展示)。
  const kindTouched = ref(false);

  // 仅 edit 模式使用的内部状态(对外暴露为 ComputedRef isEditing)。
  const editing = ref(false);

  function triggerFileInput(): void {
    fileInputRef.value?.click();
  }

  /**
   * 单文件校验:仅放行白名单 MIME + 上限字节数;失败写入 pendingError 返回 false,
   * 成功返回 true(由调用方继续设置 preview / 触发上传)。
   */
  function processFile(file: File): boolean {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as never)) {
      pendingError.value = '请选择图片文件';
      return false;
    }
    if (file.size > SPOT_MAX_UPLOAD_BYTES) {
      pendingError.value = '图片大小不能超过 5MB';
      return false;
    }
    if (pictures.value.length >= SPOT_MAX_PICTURES) {
      pendingError.value = `最多 ${SPOT_MAX_PICTURES} 张图片`;
      return false;
    }
    return true;
  }

  async function handleFile(file: File): Promise<void> {
    if (!processFile(file)) return;
    selectedFile.value = file;
    previewUrl.value = URL.createObjectURL(file);
  }

  function handleFileSelect(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      void handleFile(target.files[0]);
    }
  }

  function handleDrop(event: DragEvent): void {
    isDragging.value = false;
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      event.preventDefault();
      void handleFile(event.dataTransfer.files[0]);
    }
  }

  async function handleDropzoneSelect(files: File[]): Promise<void> {
    const f = files[0];
    if (f) await handleFile(f);
  }

  function removePicture(p: SpotPicture): void {
    pictures.value = pictures.value.filter((x) => x.id !== p.id);
    // 命中未上传预览:一并清理,避免旧 blob URL 残留
    selectedFile.value = null;
    previewUrl.value = null;
  }

  function clearPreview(): void {
    selectedFile.value = null;
    previewUrl.value = null;
    pendingError.value = null;
  }

  async function retryUpload(): Promise<void> {
    if (!selectedFile.value || isUploading.value) return;
    await doUploadThenAppend(selectedFile.value);
  }

  /** 上传文件并追加到 pictures,失败写 pendingError。 */
  async function doUploadThenAppend(file: File): Promise<void> {
    pendingError.value = null;
    try {
      const url = await upload(file);
      pictures.value.push({
        id: uuidv4().slice(0, 8),
        uploadedAt: dayjs().toISOString(),
        url,
        description: '',
      });
      selectedFile.value = null;
      previewUrl.value = null;
    } catch {
      pendingError.value = '图片上传失败,请重试';
    }
  }

  // 自动上传:selectedFile 一变就串行触发上传,与 SpotFormPanel / SpotDetailPanel 既有行为一致。
  watch(selectedFile, async (file) => {
    if (!file) return;
    if (pictures.value.length >= SPOT_MAX_PICTURES) {
      selectedFile.value = null;
      previewUrl.value = null;
      return;
    }
    await doUploadThenAppend(file);
  });

  // 释放旧 blob URL,避免内存泄漏(对齐既有 watch 写法)。
  watch(previewUrl, (_, prev) => {
    if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
  });

  // ── 派生 ──
  const canAddMore = computed(() => pictures.value.length < SPOT_MAX_PICTURES);

  const canSubmit = computed(() => {
    if (isUploading.value) return false;
    if (mode === 'create') {
      return (
        draft.value.name.trim().length > 0 &&
        draft.value.kind !== null &&
        draft.value.coordinate !== null
      );
    }
    // edit 模式:kind/location 由其它 seam 接手,seam 仅看 name 是否非空。
    return draft.value.name.trim().length > 0;
  });

  const isDirty = computed(() => {
    const base = baseDetail.value;
    if (mode !== 'edit' || !base) return false;
    const d = draft.value;
    const baseTags = (base.tags ?? []).join(', ');
    return (
      d.name !== (base.name ?? '') ||
      d.description !== (base.description ?? '') ||
      d.tags !== baseTags ||
      d.rating !== (base.rating ?? 0) ||
      d.kind !== (base.kind ?? null)
    );
  });

  const isEditing = computed(() => (mode === 'edit' ? editing.value : false));

  // ── edit 模式动作 ──
  function startEdit(): void {
    if (mode !== 'edit' || !initial) return;
    draft.value = spotDetailToDraft(initial);
    pictures.value = imagesToPictures(initial);
    pendingError.value = null;
    selectedFile.value = null;
    previewUrl.value = null;
    editing.value = true;
  }

  function cancelEdit(): void {
    if (mode !== 'edit') return;
    const base = baseDetail.value;
    if (base) {
      draft.value = spotDetailToDraft(base);
      pictures.value = imagesToPictures(base);
    } else {
      draft.value = makeEmptyDraft(initialLocation);
      pictures.value = [];
    }
    pendingError.value = null;
    selectedFile.value = null;
    previewUrl.value = null;
    editing.value = false;
  }

  function resetAfterSubmit(): void {
    if (mode === 'create') {
      draft.value = makeEmptyDraft(initialLocation);
      pictures.value = [];
      pendingError.value = null;
      kindTouched.value = false;
      selectedFile.value = null;
      previewUrl.value = null;
    } else {
      cancelEdit();
    }
  }

  function resetFrom(next: SpotDetail): void {
    if (mode !== 'edit') return;
    baseDetail.value = next;
    draft.value = spotDetailToDraft(next);
    pictures.value = imagesToPictures(next);
    pendingError.value = null;
    selectedFile.value = null;
    previewUrl.value = null;
    editing.value = false;
    kindTouched.value = false;
  }

  function buildPayload(): CreateFishingSpotPayload | UpdateFishingSpotPayload {
    if (mode === 'create') {
      const tagsArr = draft.value.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const payload: CreateFishingSpotPayload = {
        name: draft.value.name.trim(),
        description: draft.value.description.trim(),
        tags: tagsArr,
        rating: draft.value.rating,
        kind: draft.value.kind ?? 'lake',
        location: draft.value.coordinate as [number, number],
        images: pictures.value.map((p) => p.url),
      };
      return payload;
    }
    // edit 模式:Partial<CreateFishingSpotPayload>,不含 id(id 由调用方在 update 时传入)
    const tagsArr = draft.value.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const payload: UpdateFishingSpotPayload = {
      name: draft.value.name.trim(),
      description: draft.value.description.trim(),
      tags: tagsArr,
      rating: draft.value.rating,
      kind: draft.value.kind ?? undefined,
      images: pictures.value.map((p) => p.url),
    };
    return payload;
  }

  return {
    draft,
    pictures,
    pendingError,
    isUploading,
    progress,
    selectedFile,
    previewUrl,
    isDragging,
    fileInputRef,
    kindTouched,
    canAddMore,
    canSubmit,
    isDirty,
    isEditing,
    triggerFileInput,
    handleFile,
    handleFileSelect,
    handleDrop,
    handleDropzoneSelect,
    removePicture,
    clearPreview,
    retryUpload,
    startEdit,
    cancelEdit,
    resetAfterSubmit,
    resetFrom,
    buildPayload,
  };
}

// ── helpers ──

/** create 模式下的空 draft;coordinate 初始取 initialLocation ?? null。 */
function makeEmptyDraft(initialLocation?: [number, number]): SpotEditorDraft {
  return {
    name: '',
    description: '',
    tags: '',
    rating: 0,
    kind: null,
    coordinate: initialLocation ?? null,
  };
}

/** 把 SpotDetail 拍平成编辑器草稿(coordinate 字段在 edit 模式下始终 null)。 */
function spotDetailToDraft(detail: SpotDetail): SpotEditorDraft {
  return {
    name: detail.name ?? '',
    description: detail.description ?? '',
    tags: (detail.tags ?? []).join(', '),
    rating: detail.rating ?? 0,
    kind: detail.kind ?? null,
    coordinate: null,
  };
}

/** 把 SpotDetail.images 拍成 SpotPicture 数组 —— 与既有组件风格一致:uploadedAt 留空。 */
function imagesToPictures(detail: SpotDetail): SpotPicture[] {
  return (detail.images ?? []).map((url, idx) => ({
    id: detail.id ? `${detail.id}-${idx}` : uuidv4().slice(0, 8),
    url,
    uploadedAt: '',
    description: '',
  }));
}
