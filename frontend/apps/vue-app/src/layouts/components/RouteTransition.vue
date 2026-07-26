<template>
  <RouterView v-slot="{ Component }">
    <template v-if="isEntryView">
      <component :is="Component" :key="route.path" />
    </template>
    <Transition v-else :name="transitionName" mode="out-in">
      <div :key="route.path">
        <component :is="Component" />
      </div>
    </Transition>
  </RouterView>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { resolveTransitionName } from '@/lib';

defineOptions({ name: 'RouteTransition' });

const { entryPath = '/' } = defineProps<{
  entryPath?: string;
}>();

const route = useRoute();
const transitionName = computed(() =>
  resolveTransitionName(route.meta.transition),
);
const isEntryView = computed(() => route.path === entryPath);
</script>
