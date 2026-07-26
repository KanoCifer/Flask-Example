<template>
  <transition
    enter-active-class="transition-[transform,opacity,filter] transform-gpu duration-200 ease-out"
    enter-from-class="opacity-0 scale-95 -translate-y-1 filter blur-sm"
    enter-to-class="opacity-100 scale-100 translate-y-0 filter blur-0"
    leave-active-class="transition-all transform-gpu duration-150 ease-out"
    leave-from-class="opacity-100 scale-100 translate-y-0 filter blur-0"
    leave-to-class="opacity-0 scale-95 -translate-y-1 filter blur-sm"
  >
    <slot />
  </transition>
</template>

<script setup lang="ts">
defineOptions({ name: 'DropdownTransition' });
</script>
