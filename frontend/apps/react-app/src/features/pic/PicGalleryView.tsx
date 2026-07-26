import {
  galleryService,
  type Picture,
} from '@/features/pic/api/galleryService';
import { useAuthStore } from '@/features/auth';
import { useNotificationStore } from '@/stores/notificationState';
import dayjs from 'dayjs';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar,
  ImageOff,
  ImagePlus,
  Loader2,
  Pencil,
  Trash2,
  Upload,
  UploadCloud,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;

function createPictureId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

export default function PicGalleryView() {
  const auth = useAuthStore();
  const notifier = useNotificationStore();
  const service = useMemo(() => galleryService(), []);
  const canEdit = Boolean(auth.user?.is_admin);

  const [images, setImages] = useState<Picture[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');

  const [showUploadModal, setShowUploadModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadDescription, setUploadDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const selectedImage = useMemo(
    () => images.find((img) => img.id === selectedImageId) ?? null,
    [images, selectedImageId],
  );

  const fetchGalleryImages = useCallback(async () => {
    try {
      const data = await service.getGallery();
      setImages(data.images);
    } catch {
      notifier.error('获取照片墙数据失败');
    }
  }, [notifier, service]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchGalleryImages();
  }, [fetchGalleryImages]);

  useEffect(() => {
    if (!canEdit) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsEditMode(false);
      setShowUploadModal(false);
    }
  }, [canEdit]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const ensureAdminPermission = useCallback(() => {
    if (!canEdit) {
      notifier.error('仅管理员可编辑图片');
      return false;
    }
    return true;
  }, [canEdit, notifier]);

  const saveGallery = useCallback(
    async (nextImages: Picture[]) => {
      await service.saveGallery({
        images: nextImages.map((img) => ({
          id: img.id,
          url: img.url,
          description: img.description,
          uploadedAt: img.uploadedAt,
        })),
      });
    },
    [service],
  );

  const toggleEditMode = () => {
    if (!ensureAdminPermission()) return;
    setIsEditMode((prev) => !prev);
  };

  const closeUploadModal = useCallback(() => {
    setShowUploadModal(false);
    setSelectedFile(null);
    setUploadDescription('');
    setPreviewUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return null;
    });
  }, []);

  const openUploadModal = () => {
    if (!ensureAdminPermission()) return;
    setShowUploadModal(true);
  };

  const openImageDetail = (image: Picture) => {
    setSelectedImageId(image.id);
    setEditDescription(image.description);
  };

  const closeImageDetail = () => {
    setSelectedImageId(null);
    setEditDescription('');
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return dayjs(dateStr).format('YYYY年MM月DD日 HH:mm');
  };

  const processFile = (file: File) => {
    if (!canEdit) return;
    if (!file.type.startsWith('image/')) {
      notifier.error('请选择图片文件');
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      notifier.error('图片大小不能超过 5MB');
      return;
    }

    setSelectedFile(file);
    setPreviewUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return URL.createObjectURL(file);
    });
  };

  const triggerFileInput = () => {
    if (!canEdit) return;
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const uploadImage = async () => {
    if (!ensureAdminPermission()) return;
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const uploadedUrl = await service.uploadGalleryImage(formData);

      const newImage: Picture = {
        id: createPictureId(),
        uploadedAt: dayjs().toISOString(),
        url: uploadedUrl,
        description: uploadDescription.trim(),
      };
      const nextImages = [...images, newImage];

      await saveGallery(nextImages);
      setImages(nextImages);
      notifier.success('图片上传成功');
      closeUploadModal();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '图片上传或保存失败';
      notifier.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  const updateDescription = async () => {
    if (!ensureAdminPermission()) return;
    if (!selectedImage) return;

    const nextImages = images.map((img) =>
      img.id === selectedImage.id
        ? { ...img, description: editDescription.trim() }
        : img,
    );

    try {
      await saveGallery(nextImages);
      setImages(nextImages);
      notifier.success('描述已更新');
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存失败';
      notifier.error(message);
    }
  };

  const deleteImage = async (id: string) => {
    if (!ensureAdminPermission()) return;
    const nextImages = images.filter((img) => img.id !== id);
    try {
      await saveGallery(nextImages);
      setImages(nextImages);
      closeImageDetail();
      notifier.success('图片已删除');
    } catch (error) {
      const message = error instanceof Error ? error.message : '删除失败';
      notifier.error(message);
    }
  };

  return (
    <div className="bg-page relative min-h-dvh pb-40">
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-40 dark:opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, #9ca3af 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-10 px-4 pt-6">
        <div className="mx-auto w-full max-w-md">
          <p className="text-ink text-xs font-semibold tracking-wide uppercase">
            Mobile Gallery
          </p>
          <h1 className="text-ink mt-1 text-2xl font-bold">图片墙</h1>
          <p className="text-muted mt-1 text-sm">瀑布流展示，点击查看详情</p>
        </div>
      </div>

      <div className="relative z-10 mx-auto mt-4 w-full max-w-md px-4">
        {images.length === 0 ? (
          <div className="flex items-center justify-center py-32">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, type: 'spring' }}
              className="/80 bg-page/70 w-full max-w-xs rounded-[2rem] border p-8 text-center shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] backdrop-blur-xl"
            >
              <div className="from-accent/10 to-accent/10 text-ink mx-auto mb-6 flex h-18 w-18 items-center justify-center rounded-2xl bg-linear-to-tr shadow-inner">
                <ImageOff className="h-9 w-9" strokeWidth={1.5} />
              </div>
              <h3 className="text-ink text-xl font-bold tracking-tight">
                还没有图片
              </h3>
              <p className="text-muted mt-2 text-sm">
                你的图片墙还是空白，上传第一张照片吧
              </p>
              {canEdit && (
                <button
                  type="button"
                  className="bg-ink text-page hover:bg-ink/90 mt-6 rounded-full px-6 py-2.5 text-sm font-medium shadow-sm transition-colors"
                  onClick={openUploadModal}
                >
                  开始上传
                </button>
              )}
            </motion.div>
          </div>
        ) : (
          <div className="columns-2 gap-3">
            {images.map((image, index) => (
              <motion.div
                key={image.id}
                className="mb-3 break-inside-avoid"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.4,
                  delay: index * 0.03,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <div
                  className="bg-page ring-border group relative cursor-pointer overflow-hidden rounded-2xl shadow-sm ring-1 transition-shadow hover:shadow-md"
                  onClick={() => openImageDetail(image)}
                >
                  <img
                    src={image.url}
                    alt={image.description || 'gallery image'}
                    className="w-full object-cover"
                    loading="lazy"
                  />
                  {image.description && (
                    <div className="bg-page/90 pointer-events-none absolute inset-x-0 bottom-0 translate-y-full p-2.5 opacity-0 backdrop-blur-sm transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                      <p className="text-ink line-clamp-2 text-xs leading-snug">
                        {image.description}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {canEdit && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.75rem)] left-1/2 z-40 w-fit -translate-x-1/2">
          <div className="/50 bg-page/85 rounded-2xl border p-2 shadow-[0_10px_30px_rgba(0,0,0,0.12)] backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleEditMode}
                className={`/70 flex h-10 items-center gap-2 rounded-xl border px-3 text-sm shadow-sm ${
                  isEditMode ? 'bg-accent/10 text-ink' : 'text-ink'
                }`}
              >
                <Pencil className="h-4 w-4" />
                {isEditMode ? '完成编辑' : '编辑'}
              </button>

              <button
                type="button"
                onClick={openUploadModal}
                className="bg-ink text-page hover:bg-ink/90 flex h-10 items-center rounded-xl px-3 shadow-sm transition-colors"
              >
                <Upload className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {selectedImage && (
          <motion.div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeImageDetail}
          >
            <div className="absolute inset-0 bg-black/45 backdrop-blur-md" />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-page/95 ring-border relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] shadow-2xl ring-1 backdrop-blur-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={closeImageDetail}
                className="bg-page/10 text-muted hover:bg-page/20 absolute top-4 right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-md transition-all hover:scale-105 active:scale-95"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="bg-surface/50 relative flex max-h-[62dvh] w-full items-center justify-center p-4">
                <img
                  src={selectedImage.url}
                  alt={selectedImage.description || 'detail image'}
                  className="ring-border h-auto max-h-full w-auto max-w-full rounded-xl object-contain shadow-lg ring-1"
                />
              </div>

              <div className="bg-page/60 space-y-4 p-5">
                <div className="text-muted flex items-center text-sm font-medium">
                  <Calendar className="mr-1.5 h-4 w-4" />
                  {formatDate(selectedImage.uploadedAt)}
                </div>

                {canEdit && isEditMode ? (
                  <div className="space-y-3">
                    <label className="text-muted text-xs font-semibold tracking-wider uppercase">
                      修改描述
                    </label>
                    <textarea
                      value={editDescription}
                      onChange={(event) =>
                        setEditDescription(event.target.value)
                      }
                      rows={3}
                      placeholder="输入新的描述..."
                      className="/80 bg-page text-ink placeholder-muted focus:border-ring focus:ring-ring w-full resize-none rounded-xl border px-4 py-3 text-sm shadow-sm transition-all focus:ring-1 focus:outline-none"
                    />
                    <div className="flex justify-end gap-3 pt-1">
                      <button
                        type="button"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive flex items-center gap-1 rounded-full px-4 py-2 text-sm shadow-sm transition-colors"
                        onClick={() => deleteImage(selectedImage.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        删除图片
                      </button>
                      <button
                        type="button"
                        className="bg-ink text-page hover:bg-ink/90 rounded-full px-5 py-2 text-sm shadow-sm transition-colors"
                        onClick={updateDescription}
                      >
                        保存修改
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-surface/80 text-muted rounded-md p-4 text-base whitespace-pre-wrap">
                    {selectedImage.description || '暂无描述'}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showUploadModal && canEdit && (
          <motion.div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeUploadModal}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-page/95 ring-border relative z-10 w-full max-w-md rounded-[2rem] p-6 shadow-2xl ring-1 backdrop-blur-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={closeUploadModal}
                className="text-muted hover:bg-surface hover:text-ink absolute top-5 right-5 flex h-8 w-8 items-center justify-center rounded-full transition-colors"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="mb-6 text-center">
                <div className="bg-accent/10 text-ink mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <h3 className="text-ink text-xl font-bold tracking-tight">
                  上传新图片
                </h3>
                <p className="text-muted mt-1 text-sm">添加到你的照片墙</p>
              </div>

              <div
                className="/80 bg-secondary/50 hover: hover:bg-secondary flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all"
                onClick={triggerFileInput}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />

                {previewUrl ? (
                  <div className="relative w-full">
                    <img
                      src={previewUrl}
                      alt="preview"
                      className="mx-auto max-h-48 rounded-xl object-contain shadow-md"
                    />
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="rounded-full bg-black/40 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-md">
                        更换图片
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="bg-page ring-border mb-4 flex h-14 w-14 items-center justify-center rounded-full shadow-sm ring-1 transition-transform group-hover:scale-110">
                      <ImagePlus
                        className="text-muted group-hover:text-ink h-6 w-6 transition-colors"
                        strokeWidth={1.5}
                      />
                    </div>
                    <p className="text-muted text-sm font-medium">
                      点击选择图片
                    </p>
                    <p className="text-muted mt-2 text-xs">
                      支持 JPG、PNG、GIF、WebP (最大 5MB)
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6">
                <label className="text-muted text-xs font-semibold tracking-wider uppercase">
                  照片描述（可选）
                </label>
                <input
                  value={uploadDescription}
                  onChange={(event) => setUploadDescription(event.target.value)}
                  type="text"
                  placeholder="为这张图片添加描述..."
                  className="/80 bg-page text-ink placeholder-muted focus:border-ring focus:ring-ring mt-2 w-full rounded-xl border px-4 py-3 text-sm shadow-sm transition-all focus:ring-1 focus:outline-none"
                />
              </div>

              <div className="mt-8 flex gap-3">
                <button
                  type="button"
                  className="bg-page text-muted hover:bg-surface flex-1 rounded-xl border py-3 text-sm font-medium shadow-sm transition-colors"
                  onClick={closeUploadModal}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="bg-ink text-page hover:bg-ink/90 flex flex-1 items-center justify-center rounded-xl py-3 text-sm font-medium shadow-md transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!selectedFile || isUploading}
                  onClick={uploadImage}
                >
                  {isUploading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {isUploading ? '上传中...' : '确认上传'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
