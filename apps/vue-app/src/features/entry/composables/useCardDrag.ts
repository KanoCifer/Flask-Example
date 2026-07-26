import { useCardLayoutStore } from '@/features/entry/cardLayout';
import { computed, ref } from 'vue';

interface DragState {
  cardName: string;
  startX: number;
  startY: number;
  originalOffsetX: number;
  originalOffsetY: number;
}

// ── Singleton state (only one card dragged at a time) ─────────────────────
// draggingCardName drives the reactive `.is-dragging` class on DragWrapper,
// which in turn triggers the lift animation. The live position itself is
// committed straight to the store on every pointermove — no inline DOM style.

const draggingCard = ref<DragState | null>(null);
let layoutStore: ReturnType<typeof useCardLayoutStore> | null = null;

// ── Composable (singleton — shared across all DragWrapper instances) ──────

export function useCardDrag() {
  if (!layoutStore) layoutStore = useCardLayoutStore();

  function onCardPointerDown(
    e: PointerEvent,
    cardName: string,
    _element: HTMLElement,
  ) {
    if (!layoutStore!.isEditing) return;
    e.preventDefault();

    const original = layoutStore!.getOffset(cardName);
    draggingCard.value = {
      cardName,
      startX: e.clientX,
      startY: e.clientY,
      originalOffsetX: original.x,
      originalOffsetY: original.y,
    };

    // Register listeners lazily — only while dragging.
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerCancel);
  }

  function onPointerMove(e: PointerEvent) {
    if (!draggingCard.value || !layoutStore) return;
    const dx = e.clientX - draggingCard.value.startX;
    const dy = e.clientY - draggingCard.value.startY;

    // Pure store commit — reactive :style="position" on DragWrapper picks it
    // up via usePositionRef (which dedupes unchanged top/left). No inline
    // DOM style: this eliminates any "store + inline translate" overlap
    // window, so the 2dx flash on release cannot occur.
    layoutStore.setOffset(draggingCard.value.cardName, {
      x: Math.round(draggingCard.value.originalOffsetX + dx),
      y: Math.round(draggingCard.value.originalOffsetY + dy),
    });
  }

  function detach() {
    draggingCard.value = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerCancel);
  }

  function onPointerUp() {
    // The card is already sitting at the committed offset from the last
    // pointermove. Nothing to reconcile — just detach listeners.
    detach();
  }

  function onPointerCancel() {
    if (draggingCard.value && layoutStore) {
      // Roll back to where this drag started.
      layoutStore.setOffset(draggingCard.value.cardName, {
        x: draggingCard.value.originalOffsetX,
        y: draggingCard.value.originalOffsetY,
      });
    }
    detach();
  }

  // Name of the card currently being dragged (reactive). DragWrapper watches
  // this to toggle its own `.is-dragging` lift class.
  const draggingCardName = computed(() => draggingCard.value?.cardName ?? null);

  return {
    isEditing: layoutStore.isEditing,
    onCardPointerDown,
    draggingCardName,
  };
}
