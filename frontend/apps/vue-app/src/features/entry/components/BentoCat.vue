<template>
  <motion.div
    :initial="{ scale: 0 }"
    :animate="{ scale: 1 }"
    :whileHover="HOVER_SCALE_UP"
    :whileTap="TAP_SCALE_DOWN"
  >
    <img
      class="cat squircle mx-auto aspect-auto size-48 transform transform-gpu rounded-4xl shadow-2xl transition-transform hover:scale-105 hover:rotate-2"
      src="/images/animal-badge/fox.png"
      alt="Fox Badge"
      decoding="async"
    />
  </motion.div>
</template>

<script setup lang="ts">
import { motion } from 'motion-v';
import { HOVER_SCALE_UP, TAP_SCALE_DOWN } from '@/constants';
</script>
