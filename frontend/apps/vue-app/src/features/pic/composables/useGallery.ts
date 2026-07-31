import {
  galleryGateway,
  type ExifInfo,
  type GalleryImage,
  type UpdateImagePayload,
} from '@readinglist/api';
import { useNotificationStore } from '@/stores';
import { rewriteMediaUrl } from '@/composables';
import dayjs from 'dayjs';
import { v4 } from 'uuid';
import { ref } from 'vue';

// 照片墙数据与持久化
export const useGallery = () => {
  const images = ref<GalleryImage[]>([]);

  // 获取照片墙图片数据
  const fetchGalleryImages = async () => {
    try {
      const response = await galleryGateway.getGallery();
      // 保留后端原值(rawUrl)供保存回传;展示用 rewrite 后的完整 URL
      images.value = response.images.map((img) => ({
        ...img,
        rawUrl: img.url,
        url: rewriteMediaUrl(img.url),
        ...(img.thumbnailUrl && { thumbnailUrl: rewriteMediaUrl(img.thumbnailUrl) }),
        ...(img.mediumUrl && { mediumUrl: rewriteMediaUrl(img.mediumUrl) }),
      }));
    } catch {
      useNotificationStore().error('获取照片墙数据失败');
    }
  };

  // 保存照片墙数据
  const saveGallery = async () => {
    try {
      await galleryGateway.saveGallery({
        images: images.value.map((img) => ({
          id: img.id,
          url: img.rawUrl ?? img.url,
          description: img.description,
          uploadedAt: img.uploadedAt,
        })),
      });
    } catch {
      useNotificationStore().error('保存失败');
    }
  };

  // PATCH 单图元数据（description / uploadedAt / exif）—— 乐观更新 + 失败回滚
  const updateImage = async (id: string, partial: UpdateImagePayload) => {
    const index = images.value.findIndex((img) => img.id === id);
    if (index === -1) return;
    const target = images.value[index];
    const prev = { ...target };
    // 就地合并，保持响应性（PicDetailModal 的 selectedImage 指向同一对象）
    if (partial.description !== undefined) target.description = partial.description;
    if (partial.uploadedAt !== undefined) {
      target.uploadedAt = partial.uploadedAt ?? undefined;
    }
    if (partial.exif !== undefined) {
      target.exif = partial.exif as unknown as ExifInfo;
    }
    try {
      await galleryGateway.updateImage(id, partial);
      useNotificationStore().success('图片信息已更新');
    } catch {
      Object.assign(target, prev); // 回滚
      useNotificationStore().error('图片信息更新失败');
    }
  };

  // Delete image by id (returns true if removed)
  const deleteImage = async (id: string): Promise<boolean> => {
    const index = images.value.findIndex((img) => img.id === id);
    if (index !== -1) {
      images.value.splice(index, 1);
      await saveGallery();
      useNotificationStore().success('图片已删除');
      return true;
    }
    return false;
  };

  // Format date helper
  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    return dayjs(dateStr).format('YYYY年MM月DD日 HH:mm');
  };

  return {
    images,
    fetchGalleryImages,
    saveGallery,
    updateImage,
    deleteImage,
    formatDate,
  };
};

// Generate a short id for a newly uploaded picture
export const newPictureId = () => v4().slice(0, 8);
