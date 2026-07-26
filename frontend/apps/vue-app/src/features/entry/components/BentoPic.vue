<template>
  <BentoCard
    class="group relative min-w-0 overflow-hidden"
    @click.stop="$router.push('/gallery')"
  >
    <!-- LCP 元素：不能用 lazy，必须 eager + fetchpriority=high -->
    <img
      loading="eager"
      fetchpriority="high"
      decoding="async"
      :src="imageSrc"
      class="squircle bg-surface mx-auto block h-50 w-82 object-cover p-0"
      alt="Bento Card Image"
    />
  </BentoCard>
</template>

<script setup lang="ts">
import { BentoCard } from '@/components';
import { useCardImage } from '@/features/entry/composables';

const { imageSrc } = useCardImage();
</script>
