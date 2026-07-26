<script setup lang="ts">
import { computed } from 'vue';
import { useCardImage } from '@/features/entry';

const { cardIndex, cardImages, setCardIndex } = useCardImage();

const total = cardImages.length;

const toPrev = () => {
  setCardIndex(Math.max(0, cardIndex.value - 1));
};

const toNext = () => {
  setCardIndex(Math.min(total - 1, cardIndex.value + 1));
};

interface Transform {
  rotate: number;
  x: number;
  z: number;
  scale: number;
  opacity: number;
  zIndex: number;
  visible: boolean;
}

/**
 * 计算每张卡片的 3D 变换：当前卡放大、无旋转、向前推；
 * 两侧卡片按距离旋转 / 缩放 / 淡出，远离视野的卡片不渲染。
 */
function transformFor(index: number): Transform {
  const offset = index - cardIndex.value;
  const abs = Math.abs(offset);
  const rotate = offset === 0 ? 0 : offset < 0 ? 38 : -38;
  return {
    rotate,
    x: offset * 60,
    z: offset === 0 ? 50 : -abs * 60,
    scale: offset === 0 ? 1.1 : 1 - abs * 0.08,
    opacity: abs > 1 ? 0 : 1 - abs * 0.25,
    zIndex: 100 - abs,
    visible: abs <= 1,
  };
}

const canPrev = computed(() => cardIndex.value > 0);
const canNext = computed(() => cardIndex.value < total - 1);
</script>

<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-ink mb-1 font-serif text-lg font-semibold">卡片配图</h2>
      <p class="text-muted mb-4 text-xs italic">Card cover image</p>

      <!-- Coverflow 舞台：perspective + 3D 变换 -->
      <div
        class="relative mx-auto h-44 w-full max-w-xs overflow-hidden rounded-xl"
        style="perspective: 1000px"
      >
        <button
          v-for="(image, i) in cardImages"
          v-show="transformFor(i).visible"
          :key="i"
          type="button"
          :aria-label="`卡片 ${i + 1}`"
          :aria-pressed="cardIndex === i"
          @click="setCardIndex(i)"
          class="absolute top-1/2 left-1/2 aspect-[3/4] w-20 origin-center cursor-pointer rounded-xl border bg-cover bg-center shadow-md transition-all duration-300 ease-out"
          :class="
            cardIndex === i
              ? 'border-accent shadow-lg'
              : 'border-white/10 hover:brightness-110'
          "
          :style="{
            backgroundImage: `url(${image})`,
            transform: `translate(-50%, -50%) translateX(${transformFor(i).x}px) translateZ(${transformFor(i).z}px) rotateY(${transformFor(i).rotate}deg) scale(${transformFor(i).scale})`,
            opacity: transformFor(i).opacity,
            zIndex: transformFor(i).zIndex,
          }"
        />
      </div>

      <!-- 控制条：上一张 / 指示点 / 下一张 -->
      <div
        class="mx-auto mt-5 flex w-fit items-center gap-2 self-center rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 shadow-sm backdrop-blur-md"
      >
        <button
          type="button"
          :disabled="!canPrev"
          aria-label="上一张"
          @click="toPrev"
          class="text-ink flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="h-3.5 w-3.5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <div class="flex items-center gap-1">
          <button
            v-for="(_, i) in cardImages"
            :key="i"
            type="button"
            :aria-label="`卡片 ${i + 1}`"
            :aria-pressed="cardIndex === i"
            @click="setCardIndex(i)"
            class="h-1 cursor-pointer rounded-full transition-all duration-300"
            :class="
              cardIndex === i ? 'bg-ink w-4' : 'bg-ink/30 hover:bg-ink/50 w-1.5'
            "
          />
        </div>

        <button
          type="button"
          :disabled="!canNext"
          aria-label="下一张"
          @click="toNext"
          class="text-ink flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="h-3.5 w-3.5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
