<template>
  <header
    class="/60 bg-page/90 sticky top-0 z-10 border-b px-4 py-4 backdrop-blur-md"
  >
    <div class="mx-auto w-full max-w-6xl">
      <div class="flex items-start justify-between gap-3">
        <div class="ml-12 space-y-1">
          <h1 class="text-ink mt-2 font-serif text-2xl font-semibold">
            DeviceTracker
          </h1>
        </div>
        <button
          type="button"
          @click="handleBack"
          class="bg-accent text-ink shadow-accent/50 hover:bg-accent/90 min-h-11 rounded-2xl px-6 text-sm font-medium shadow-md transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          返回
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

function handleBack() {
  router.back();
}
</script>
