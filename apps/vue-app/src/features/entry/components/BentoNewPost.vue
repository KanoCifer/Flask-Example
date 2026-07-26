<template>
  <motion.div
    :initial="{ scale: 0 }"
    :animate="{ scale: 1 }"
    :while-hover="HOVER_SCALE_UP"
    :while-press="{ scale: 0.9 }"
    class="w-auto"
  >
    <button
      class="squircle bg-accent/80 text-ink ring-border/30 focus-visible:outline-accent flex cursor-pointer items-center px-4 py-2 text-2xl font-semibold ring focus-visible:outline-2 focus-visible:outline-offset-2"
      @click="handleClick"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="mr-2 h-4 w-4"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
          clip-rule="evenodd"
        />
      </svg>
      New
    </button>
  </motion.div>
</template>

<script setup lang="ts">
import { motion } from 'motion-v';
import { HOVER_SCALE_UP } from '@/constants';
import { useRouter } from 'vue-router';
const router = useRouter();

const handleClick = () => {
  router.push('/blog/new');
};
</script>
