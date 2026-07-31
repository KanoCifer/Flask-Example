import { useNotificationStore } from '@/stores';
import { ref, type Ref } from 'vue';
import type { Picture } from './useGallery';

interface UsePolaroidLayoutOptions {
  images: Ref<Picture[]>;
}

/**
 * Polaroid 瀑布流布局（紧凑 grid 瀑布流版）
 *
 * 每张卡的 row-span 由后端真实 aspectRatio × 列宽算出：
 *   card_height = 列宽 / aspectRatio + 底部白边(52px)
 *   row_span = round(card_height / ROW_HEIGHT)
 *
 * 图片本身用 aspect-ratio 自己撑开高度,卡片父容器不再 stretch。
 * 横图 → 矮, 竖图 → 高,与照片真实比例一致。
 */
export const usePolaroidLayout = ({ images }: UsePolaroidLayoutOptions) => {
  // 每张照片的视觉种子：旋转角度 + row-span(由 aspectRatio 计算)
  const visualSeeds = ref<Map<number, { rotation: number; rowSpan: number }>>(
    new Map(),
  );

  // 紧凑瀑布流参数 —— row 单位高度越小,密度越高
  const ROW_HEIGHT = 8; // 8px 一行(配合底部白边让比例更准)

  // 拍立得固定开销:顶部 mx-2 mt-3(8px 白边) + 底部 52px 留白区 + 3px polaroid 内 padding
  const POLAROID_BOTTOM = 52;
  const POLAROID_TOP_MARGIN = 8;
  const POLAROID_VERTICAL_PADDING = 6;

  /**
   * 根据后端 aspectRatio 计算 row-span
   * aspectRatio = width / height (后端约定)
   * 列宽固定 220px → 图片自然高度 = 220 / aspectRatio
   * 卡片高度 = 图片高度 + 拍立得顶部白边 + 底部白边
   */
  const computeRowSpan = (img: Picture | undefined): number => {
    const ar =
      (img?.aspectRatio && img.aspectRatio > 0 ? img.aspectRatio : null) ??
      (img?.width && img.height && img.height > 0
        ? img.width / img.height
        : 1);
    const CARD_WIDTH = 220;
    const imageHeight = CARD_WIDTH / ar; // 后端 aspect = w/h, 横向 ar 大 → 图片矮
    const cardHeight =
      imageHeight + POLAROID_BOTTOM + POLAROID_TOP_MARGIN + POLAROID_VERTICAL_PADDING;
    // 限制最小/最大行数,避免极端比例
    return Math.max(20, Math.min(80, Math.round(cardHeight / ROW_HEIGHT)));
  };

  const generateLayoutSeeds = () => {
    visualSeeds.value.clear();
    images.value.forEach((img, index) => {
      visualSeeds.value.set(index, {
        rotation: (Math.random() - 0.5) * 6, // ±3°
        rowSpan: computeRowSpan(img),
      });
    });
  };

  const shuffleImages = () => {
    generateLayoutSeeds();
    useNotificationStore().success('照片已重新排布');
  };

  // 保留空壳,避免外部调用处(已迁移)误用时报错——返回 no-op
  const bringToFront = (_index: number) => {};

  const getRowSpan = (index: number) =>
    visualSeeds.value.get(index)?.rowSpan ?? 30;

  const getRotation = (index: number) =>
    visualSeeds.value.get(index)?.rotation ?? 0;

  return {
    visualSeeds,
    generateLayoutSeeds,
    shuffleImages,
    bringToFront,
    getRowSpan,
    getRotation,
  };
};