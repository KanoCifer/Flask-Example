import { useNotificationStore } from '@/stores';
import { ref, type Ref } from 'vue';
import type { GalleryImage } from '@readinglist/api';

interface UsePolaroidLayoutOptions {
  images: Ref<GalleryImage[]>;
}

/**
 * Polaroid 瀑布流布局（多列 columns 版）
 *
 * 卡片高度由图片 aspect-ratio 自然撑开,无需手工计算高度;
 * 这里只负责每张照片的视觉种子:旋转角度(±3° 随机)。
 */
export const usePolaroidLayout = ({ images }: UsePolaroidLayoutOptions) => {
  // 每张照片的视觉种子：旋转角度
  const visualSeeds = ref<Map<number, { rotation: number }>>(new Map());

  /**
   * 后端真实 aspectRatio = width / height (见 process_image.py)
   * 直接用于 CSS aspect-ratio,驱动图片区高度
   */
  const getAspectRatio = (img: GalleryImage | undefined): number => {
    const ar =
      (img?.aspectRatio && img.aspectRatio > 0 ? img.aspectRatio : null) ??
      (img?.width && img.height && img.height > 0
        ? img.width / img.height
        : 1);
    return ar; // w/h,直接用于 CSS aspect-ratio
  };

  const generateLayoutSeeds = () => {
    visualSeeds.value.clear();
    images.value.forEach((img, index) => {
      visualSeeds.value.set(index, {
        rotation: (Math.random() - 0.5) * 6, // ±3°
      });
    });
  };

  const shuffleImages = () => {
    generateLayoutSeeds();
    useNotificationStore().success('照片已重新排布');
  };

  const getRotation = (index: number) =>
    visualSeeds.value.get(index)?.rotation ?? 0;

  // 给 PolaroidCard 用的真实 aspectRatio (w/h)
  const getCardAspect = (index: number): number =>
    getAspectRatio(images.value[index]);

  return {
    visualSeeds,
    generateLayoutSeeds,
    shuffleImages,
    getRotation,
    getCardAspect,
  };
};