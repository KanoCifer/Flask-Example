import { galleryGateway, type GalleryImage } from '@readinglist/api';
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

  // Update description for a picture by id
  const updateDescription = async (id: string, description: string) => {
    const index = images.value.findIndex((img) => img.id === id);
    if (index !== -1) {
      images.value[index].description = description;
      await saveGallery();
      useNotificationStore().success('描述已更新');
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
    updateDescription,
    deleteImage,
    formatDate,
  };
};

// Generate a short id for a newly uploaded picture
export const newPictureId = () => v4().slice(0, 8);
