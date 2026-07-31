<template>
  <div
    ref="wrapperEl"
    :style="[position, { '--layout-scale': CARD_LAYOUT_SCALE }]"
    class="drag-wrapper absolute"
    :class="{
      'outline-accent/60 rounded-3xl outline-2 outline-offset-8 outline-dashed':
        layoutStore.isEditing,
      'cursor-grab': layoutStore.isEditing,
      'is-dragging': isThisCardDragging,
    }"
    @pointerdown="onPointerDown"
  >
    <div ref="scalerEl" class="card-scaler">
      <div :class="{ 'pointer-events-none': layoutStore.isEditing }">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CARD_LAYOUT_SCALE } from '@/constants';
import { useCardDrag } from '@/features/entry';
import { useCardLayoutStore } from '@/features/entry';
import type { CSSProperties } from 'vue';
import { computed, inject, onMounted, useTemplateRef, watch } from 'vue';

const props = defineProps<{
  cardName: string;
  position: CSSProperties;
  wiggleDelayMs?: number;
  registerCardSize?: (cardName: string, el: HTMLElement) => void;
}>();

const layoutStore = useCardLayoutStore();
const drag = useCardDrag();

// Provided by the nearest ancestor that called useCardLayout. Lets us report
// our measured size back for the center→top-left coordinate conversion.
const providedRegister = inject<
  ((cardName: string, el: HTMLElement) => void) | null
>('cardLayout.registerCardSize', null);
const registerCardSize = props.registerCardSize ?? providedRegister;

const wrapperEl = useTemplateRef<HTMLElement>('wrapperEl');
const scalerEl = useTemplateRef<HTMLElement>('scalerEl');

// Report the card's natural (unscaled) size — read from .card-scaler, whose
// layout box is content-sized and unaffected by `transform: scale`, so
// useCardLayout can center on the real box. (Card dims stay unscaled there;
// only the home offsets are scaled by CARD_LAYOUT_SCALE.)
onMounted(() => {
  if (scalerEl.value && registerCardSize) {
    registerCardSize(props.cardName, scalerEl.value);
  }
});

// True while THIS wrapper's card is the one being dragged. Drives the
// `.is-dragging` lift class (scale + shadow) reactively — no inline styles.
const isThisCardDragging = computed(
  () => drag.draggingCardName.value === props.cardName,
);

/* When editing flips on, play the wiggle once on each card.
   The delay staggers cards by their layout order. We watch the edge
   (false -> true) so it doesn't re-fire on unrelated edits. */
watch(
  () => layoutStore.isEditing,
  (editing, wasEditing) => {
    if (!editing || wasEditing) return; // only on the off->on edge
    const el = wrapperEl.value;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const delay = props.wiggleDelayMs ?? 0;
    // Force restart: remove class, reflow, add with the stagger delay.
    el.classList.remove('card-wiggle');
    void el.offsetHeight;
    el.style.setProperty('--wiggle-delay', `${delay}ms`);
    el.classList.add('card-wiggle');
    // Clean up after the animation completes so it can re-trigger next toggle.
    const cleanup = () => {
      el.classList.remove('card-wiggle');
      el.removeEventListener('animationend', cleanup);
    };
    el.addEventListener('animationend', cleanup);
  },
);

function onPointerDown(e: PointerEvent) {
  const el =
    (e.currentTarget as HTMLElement) ??
    ((e.target as HTMLElement).closest('.drag-wrapper') as HTMLElement);
  if (el) drag.onCardPointerDown(e, props.cardName, el);
}
</script>

<style scoped>
/* Contain layout + style so each card's internal updates (clock tick,
   reading-list / todo refreshes) never invalidate the sibling cards or the
   page's outer layout. Without it, any internal reflow/paint bubbles up to
   the shared `top/left`-positioned tree.
   Caveat: `layout` containment makes this wrapper the containing block for
   `position: fixed` descendants. No card uses fixed today — GreetingToast's
   fixed toast lives outside DragWrapper. Deliberately NOT `paint` containment,
   which would clip the is-dragging lift shadow (scale: 1.06) and any card
   popovers that extend past the box. */
.drag-wrapper {
  contain: layout style;
}

/* Visual scale for the card content.
   The .drag-wrapper's layout box is sized to the natural (Tailwind) card
   dimensions; useCardLayout scales the home offset only, not the box. So the
   visual card needs to shrink around the box center for both axes of
   alignment — use `transform-origin: center` and let the scaled visual
   occupy the inner 85% of the layout box. The extra ~7.5% padding on each
   side is invisible because box-to-box spacing is also scaled by the same
   factor in useCardLayout.
   Value comes from the shared CARD_LAYOUT_SCALE via the --layout-scale
   custom property (set on the wrapper) — one source of truth, two consumers. */
.card-scaler {
  transform-origin: center center;
  transform: scale(var(--layout-scale));
}

/* Asymmetric lift: brisk IN (grab), springy OUT (release).
   Transition sits on the base rule; the .is-dragging rule overrides
   transition-timing/duration for the grab direction, so the release
   uses the base (spring) curve. */
@media (prefers-reduced-motion: no-preference) {
  .drag-wrapper {
    transition:
      outline-color 200ms ease,
      outline-offset 200ms ease,
      top 420ms cubic-bezier(0.34, 1.56, 0.64, 1),
      left 420ms cubic-bezier(0.34, 1.56, 0.64, 1),
      scale 420ms cubic-bezier(0.34, 1.56, 0.64, 1),
      box-shadow 420ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .drag-wrapper.is-dragging {
    z-index: 100;
    cursor: grabbing;
    scale: 1.06;
    /* Promote to its own compositor layer for the lift: scale + box-shadow
       animate on the compositor instead of repainting. Temporary — only while
       actively dragging. (contain: layout style above does not clip the
       oversized shadow; will-change only upgrades the animation pipeline.) */
    will-change: transform;
    /* During a drag the card is pulled to 1:1 cursor tracking, so the lift
       (scale + shadow) must apply to the full-size visual — temporarily undo
       the 85% shrink. Without this the 6% lift would compound on the 85%
       shrink and the size change on grab/release would be jarring. */
    transform: scale(1);
    box-shadow:
      0 26px 60px -14px color-mix(in oklch, var(--ink) 20%, transparent),
      0 12px 30px -16px color-mix(in oklch, var(--ink) 12%, transparent);
    /* No top/left transition: store commits rounded pointermove deltas that
       Vue renders within the same frame (~16ms), so a CSS transition would
       only add ~7 frames ofchase-lag. Kept off for pixel-perfect tracking.
       The base rule's spring top/left still fires on settle + ESC rollback. */
    transition:
      outline-color 200ms ease,
      outline-offset 200ms ease,
      scale 180ms cubic-bezier(0.32, 0.72, 0, 1),
      box-shadow 180ms cubic-bezier(0.32, 0.72, 0, 1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .drag-wrapper {
    transition:
      outline-color 200ms ease,
      outline-offset 200ms ease;
  }
  .card-wiggle {
    animation: none;
  }
  /* lift is dropped; border ring still transitions */
}

/* Decaying-rotate wiggle. Position is now top-left (no translate(-50%,-50%)
   on the wrapper), so the wiggle only needs to apply rotate — composing
   cleanly with the .is-dragging scale override. */
@keyframes card-wiggle {
  0% {
    transform: rotate(0deg);
  }
  20% {
    transform: rotate(-1.6deg);
  }
  40% {
    transform: rotate(1.3deg);
  }
  60% {
    transform: rotate(-0.8deg);
  }
  80% {
    transform: rotate(0.4deg);
  }
  100% {
    transform: rotate(0deg);
  }
}

.card-wiggle {
  animation: card-wiggle 600ms cubic-bezier(0.36, 0, 0.66, 1) both;
  animation-delay: var(--wiggle-delay, 0ms);
}
</style>
