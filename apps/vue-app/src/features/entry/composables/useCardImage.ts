import { computed, ref } from 'vue';

/*
 * 卡片封面图库 — 三张本地静态图。
 * 顺序与 /card/card-{1,2,3}-thumb.jpeg 一一对应。
 */
const CARD_IMAGES: readonly string[] = Array.from(
  { length: 3 },
  (_, i) => `/card/card-${i + 1}-thumb.jpeg`,
);

const CARD_KEY = 'readinglist_card_imgae_index';

const getImageIndex = (): number => {
  const stored = localStorage.getItem(CARD_KEY);
  const n = stored ? parseInt(stored, 10) : NaN;
  return Number.isFinite(n) && n >= 0 && n < CARD_IMAGES.length ? n : 0;
};

const cardIndex = ref<number>(getImageIndex());
const imageSrc = computed(() => CARD_IMAGES[cardIndex.value]);

export function useCardImage() {
  const setCardIndex = (index: number) => {
    cardIndex.value = index;
    localStorage.setItem(CARD_KEY, String(index));
  };

  return {
    cardIndex,
    cardImages: CARD_IMAGES,
    setCardIndex,
    imageSrc,
  };
}
