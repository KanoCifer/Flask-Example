import { galleryGateway } from '@/features/pic/api/galleryGateway';
import { useNotificationStore } from '@/stores';
import { rewriteMediaUrl } from '@/composables';
import dayjs from 'dayjs';
import { v4 } from 'uuid';
import { ref } from 'vue';

// 照片墙图片接口
export interface ExifInfo {
  camera?: string;
  lens?: string;
  iso?: number;
  exposure?: string;
  aperture?: string;
  focalLength?: string;
  focalLength35?: string;
  takenAt?: string;
  gps?: { lat: number; lng: number };
}

export interface Picture {
  id: string;
  uploadedAt?: string;
  url: string;
  description: string;
  exif?: ExifInfo | null;
}

// 照片墙数据与持久化
export const useGallery = () => {
  const images = ref<Picture[]>([]);

  // 获取照片墙图片数据
  const fetchGalleryImages = async () => {
    try {
      const response = await galleryGateway.getGallery();
      // Convert relative URLs to full media URLs
      images.value = response.images.map((img) => ({
        ...img,
        url: rewriteMediaUrl(img.url),
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
          url: img.url,
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
