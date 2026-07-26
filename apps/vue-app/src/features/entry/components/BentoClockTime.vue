<script setup lang="ts">
import dayjs from 'dayjs';
import { ref, onMounted, onUnmounted, computed } from 'vue';

// Only update reactive state when the displayed minute actually changes,
// avoiding per-second re-render cascades.
const minuteKey = ref(dayjs().format('YYYY-MM-DD HH:mm'));

const hourLabel = computed(() => {
  // Access minuteKey to establish reactivity dependency
  void minuteKey.value;
  return dayjs().format('HH');
});
const minuteLabel = computed(() => {
  void minuteKey.value;
  return dayjs().format('mm');
});

let timer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  timer = setInterval(() => {
    const key = dayjs().format('YYYY-MM-DD HH:mm');
    if (key !== minuteKey.value) {
      minuteKey.value = key;
    }
  }, 1000);
});

onUnmounted(() => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
});
</script>

<template>
  <p
    class="text-ink/80 font-family-harmonyos mt-2 text-6xl font-bold tracking-tight"
  >
    {{ hourLabel }}<span class="animate-timer-blink mx-1">:</span
    >{{ minuteLabel }}
  </p>
</template>
