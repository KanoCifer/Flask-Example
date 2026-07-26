<script setup lang="ts">
defineProps<{
  brandWidth?: string;
  formWidth?: string;
  formMaxWidth?: string;
}>();
</script>

<template>
  <div class="bg-page flex min-h-screen">
    <!-- 左侧 Branding -->
    <div
      class="relative hidden flex-col justify-between bg-zinc-950 p-10 text-white lg:flex"
      :class="brandWidth"
    >
      <slot name="branding" />
    </div>

    <!-- 右侧 Form -->
    <div
      class="bg-page flex w-full items-center justify-center p-8"
      :class="formWidth"
    >
      <div :class="['w-full max-w-sm xl:max-w-md', formMaxWidth]">
        <slot name="header" />
        <slot />
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>
