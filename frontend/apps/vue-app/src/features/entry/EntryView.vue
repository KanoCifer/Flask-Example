<template>
  <div
    class="relative min-h-dvh w-full"
    :style="containerStyle"
    ref="parentContainer"
  >
    <FloatingActionButtons
      @openSettings="openSettings"
      @goToFriendLinks="$router.push({ name: 'friend-links' })"
      @switchToMobile="switchToMobile"
    />
    <!-- Greeting 弹窗 -->
    <GreetingToast />
    <DragWrapper
      :position="navCardPosition"
      card-name="BentoNavCard"
      :wiggle-delay="WIGGLE_DELAY.BentoNavCard"
    >
      <BentoNavCard
        :initial="{ scale: 0.5, opacity: 0 }"
        :animate="{ scale: 1, opacity: 1 }"
        :transition="{
          delay: 0.05,
        }"
        class="w-68"
      />
    </DragWrapper>
    <!-- 钓点卡片 -->
    <DragWrapper
      :position="greetingPosition"
      card-name="BentoMap"
      :wiggle-delay="WIGGLE_DELAY.BentoMap"
    >
      <BentoMap
        v-if="show.BentoMap"
        :transition="{
          delay: DELAY.BentoMap,
        }"
        class="h-auto w-2xs min-w-fit"
      />
    </DragWrapper>
    <DragWrapper
      :position="profilePosition"
      card-name="BentoProfileCard"
      :wiggle-delay="WIGGLE_DELAY.BentoProfileCard"
    >
      <BentoProfileCard
        v-if="show.BentoProfileCard"
        :transition="{
          delay: DELAY.BentoProfileCard,
        }"
        class="h-70 w-90 min-w-fit"
      />
    </DragWrapper>
    <DragWrapper
      :position="clockCardPosition"
      card-name="BentoClock"
      :wiggle-delay="WIGGLE_DELAY.BentoClock"
    >
      <BentoClock
        v-if="show.BentoClock"
        :transition="{
          delay: DELAY.BentoClock,
        }"
        class="w-auto"
      />
    </DragWrapper>
    <DragWrapper
      :position="calendarPosition"
      card-name="BentoCalendar"
      :wiggle-delay="WIGGLE_DELAY.BentoCalendar"
    >
      <BentoCalendar
        v-if="show.BentoCalendar"
        :transition="{
          delay: DELAY.BentoCalendar,
        }"
        class="w-auto"
      />
    </DragWrapper>
    <DragWrapper
      :position="techPosition"
      card-name="BentoTech"
      :wiggle-delay="WIGGLE_DELAY.BentoTech"
    >
      <BentoTech
        v-if="show.BentoTech"
        :transition="{
          delay: DELAY.BentoTech,
        }"
        class="h-2xs w-68 p-4!"
      />
    </DragWrapper>

    <DragWrapper
      :position="listCardPosition"
      card-name="BentoReadingList"
      :wiggle-delay="WIGGLE_DELAY.BentoReadingList"
    >
      <BentoReadingList
        v-if="show.BentoReadingList"
        :transition="{
          delay: DELAY.BentoReadingList,
        }"
        class="w-60 cursor-pointer"
      />
    </DragWrapper>

    <DragWrapper
      :position="todoCardPosition"
      card-name="TodoCard"
      :wiggle-delay="WIGGLE_DELAY.TodoCard"
    >
      <TodoCard
        v-if="show.TodoCard"
        :transition="{
          delay: DELAY.TodoCard,
        }"
        class="w-52"
      />
    </DragWrapper>
    <!-- <BentoCat v-if="show.BentoCat" :style="[catPosition]" class="absolute w-2xs -translate-x-1/2 -translate-y-1/2" /> -->

    <DragWrapper
      :position="picPosition"
      card-name="BentoPic"
      :wiggle-delay="WIGGLE_DELAY.BentoPic"
    >
      <!-- 新增照片卡片的拖拽容器 -->
      <BentoPic
        v-if="show.BentoPic"
        :transition="{
          delay: DELAY.BentoPic,
        }"
        class="cursor-pointer p-2!"
      />
      <!-- 中间的照片卡片 -->
    </DragWrapper>

    <!-- Settings Modal -->
    <SettingsModal v-model="isSettingsOpen" />
    <!-- Footer -->
    <Footer
      class="absolute right-0 bottom-0 left-0"
      v-if="themeStore.showFooter === 'true'"
      :isEntryView="isEntryView"
      :isAboutView="isAboutView"
    />

    <!-- Edit Layout Toolbar -->
    <Teleport to="body">
      <Transition
        enter-active-class="edit-toolbar-enter"
        enter-from-class="opacity-0 translate-y-4"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="edit-toolbar-leave"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-4"
      >
        <div
          v-if="layoutStore.isEditing"
          class="bg-page/90 fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-2xl border px-4 py-2 shadow-lg backdrop-blur-md"
        >
          <span class="text-muted px-1 text-sm font-medium"> 编辑布局 </span>
          <span class="bg-border mx-1 h-5 w-px" aria-hidden="true" />
          <button
            @click="layoutStore.cancelEditing()"
            class="text-muted hover:bg-surface cursor-pointer rounded-xl border px-4 py-2 text-sm font-medium transition-colors active:scale-[0.96]"
          >
            取消
          </button>
          <button
            @click="layoutStore.saveEditing()"
            class="bg-accent text-ink hover:bg-accent/90 cursor-pointer rounded-xl px-4 py-2 text-sm font-medium transition-colors active:scale-[0.96]"
          >
            保存
          </button>
          <button
            @click="layoutStore.resetAllOffsets()"
            class="border-destructive/30 text-destructive hover:bg-destructive/10 cursor-pointer rounded-xl border px-4 py-2 text-sm font-medium transition-colors active:scale-[0.96]"
          >
            重置
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { Footer } from '@/layouts';
import {
  BentoCalendar,
  BentoClock,
  BentoNavCard,
  BentoProfileCard,
  BentoReadingList,
  BentoTech,
  TodoCard,
} from '@/features/entry/components';
import { DragWrapper, FloatingActionButtons, SettingsModal } from '@/layouts';
import { useCardLayout } from '@/features/entry/composables';
import { useCardLayoutStore } from '@/features/entry/stores/cardLayout';
import { useThemeStore } from '@/stores';
import { cardStylesData } from '@/data';
import { onMounted, onUnmounted, ref } from 'vue';
import BentoMap from './components/BentoMap.vue';
import BentoPic from './components/BentoPic.vue';
import GreetingToast from './components/GreetingToast.vue';

type CardName =
  | 'BentoNavCard'
  | 'BentoMap'
  | 'BentoProfileCard'
  | 'BentoClock'
  | 'BentoCalendar'
  | 'BentoTech'
  | 'BentoReadingList'
  | 'TodoCard'
  | 'BentoPic';

const themeStore = useThemeStore();
const isEntryView = true;
const isAboutView = false;

const switchToMobile = () => {
  const expires = new Date();
  expires.setTime(expires.getTime() + 30 * 24 * 60 * 60 * 1000);
  document.cookie = `device_force=react;expires=${expires.toUTCString()};path=/;domain=.kanocifer.chat`;
  window.location.href = 'https://m.kanocifer.chat';
};

const parentContainer = ref<HTMLElement | null>(null);

// Card layout — all position computation in one composable
const {
  containerStyle,
  greetingPosition,
  picPosition,
  profilePosition,
  navCardPosition,
  clockCardPosition,
  calendarPosition,
  techPosition,
  listCardPosition,
  todoCardPosition,
} = useCardLayout(parentContainer);

const layoutStore = useCardLayoutStore();

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && layoutStore.isEditing) {
    layoutStore.cancelEditing();
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown);
});

const isSettingsOpen = ref(false);
const openSettings = () => {
  isSettingsOpen.value = true;
};

const show = {
  BentoNavCard: true,
  BentoProfileCard: true,
  BentoClock: true,
  BentoCalendar: true,
  BentoTech: true,
  BentoReadingList: true,
  TodoCard: true,
  BentoMap: true,
  BentoPic: true,
} as const satisfies Record<CardName, true>;

const ANIMATION_DELAY = 0.08;
const WIGGLE_STAGGER_MS = 40;

function buildDelays(): Record<CardName, number> {
  const delays = {} as Record<CardName, number>;
  for (const [name, entry] of Object.entries(cardStylesData) as [
    CardName,
    { order: number },
  ][]) {
    delays[name] = entry.order * ANIMATION_DELAY;
  }
  return delays;
}

const DELAY = buildDelays();

// ms stagger keyed by card name, for the edit-mode wiggle.
function buildWiggleDelays(): Record<CardName, number> {
  const out = {} as Record<CardName, number>;
  for (const [name, entry] of Object.entries(cardStylesData) as [
    CardName,
    { order: number },
  ][]) {
    out[name] = entry.order * WIGGLE_STAGGER_MS;
  }
  return out;
}

const WIGGLE_DELAY = buildWiggleDelays();
</script>

<style scoped>
.edit-toolbar-enter {
  transition:
    opacity 300ms ease-out,
    transform 300ms ease-out;
}

.edit-toolbar-leave {
  transition:
    opacity 200ms ease-in,
    transform 200ms ease-in;
}

@media (prefers-reduced-motion: reduce) {
  .edit-toolbar-enter,
  .edit-toolbar-leave {
    transition-duration: 0ms;
  }
}
</style>
