import { useNotificationStore } from '@/stores';
import { ref, type Ref } from 'vue';
import type { Picture } from './useGallery';

interface UsePolaroidLayoutOptions {
  images: Ref<Picture[]>;
}

/**
 * Polaroid 瀑布流布局（方案 A）
 *
 * 从"随机堆叠 pile"改为 CSS columns 瀑布流后，布局算法大幅简化：
 * - 卡片位置由 columns 流式排布，不再需要 x/y 绝对定位
 * - 仍保留每张照片稳定的 aspect 比例与轻微旋转，维持拍立得手感
 * - 选中态、删除由组件层处理；本 composable 只负责"视觉种子"
 */
export const usePolaroidLayout = ({ images }: UsePolaroidLayoutOptions) => {
  // 每张照片的视觉种子：aspect 比例 + 旋转角度（缓存，避免重渲染抖动）
  const visualSeeds = ref<Map<number, { aspect: number; rotation: number }>>(
    new Map(),
  );

  const ASPECTS = [1, 1.25, 0.8, 1.5]; // 1:1, 4:5, 5:4, 2:3

  // 为每张图片生成稳定的视觉种子（aspect + 轻微旋转）
  const generateLayoutSeeds = () => {
    visualSeeds.value.clear();
    images.value.forEach((_, index) => {
      visualSeeds.value.set(index, {
        aspect: ASPECTS[index % ASPECTS.length],
        // ±3° 轻微旋转，比堆叠版克制——瀑布流里大幅旋转会破坏列对齐
        rotation: (Math.random() - 0.5) * 6,
      });
    });
  };

  const shuffleImages = () => {
    generateLayoutSeeds();
    useNotificationStore().success('照片已重新排布');
  };

  // 保留空壳 bringToFront，避免外部调用处（已迁移）误用时报错——返回 no-op
  const bringToFront = (_index: number) => {};

  const getAspectRatio = (index: number) => {
    return (
      visualSeeds.value.get(index)?.aspect ?? ASPECTS[index % ASPECTS.length]
    );
  };

  const getRotation = (index: number) => {
    return visualSeeds.value.get(index)?.rotation ?? 0;
  };

  return {
    visualSeeds,
    generateLayoutSeeds,
    shuffleImages,
    bringToFront,
    getAspectRatio,
    getRotation,
  };
};
