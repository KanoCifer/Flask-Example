import { cardStylesData as cardStyles } from '@/data';
import { useCardLayoutStore } from '@/features/entry/cardLayout';
import {
  onUnmounted,
  provide,
  reactive,
  shallowRef,
  watch,
  type CSSProperties,
  type Ref,
} from 'vue';
import { useLayoutCenter } from './useLayoutCenter';

/** Card style entry from card-styles.json */
interface CardStyle {
  width?: number;
  height: number;
  order: number;
}

const styles = cardStyles as Record<string, CardStyle>;

const cardNamesByOrder = Object.entries(styles)
  .sort((a, b) => a[1].order - b[1].order)
  .map(([name]) => name);

const maxOrder = Math.max(...Object.values(styles).map((s) => s.order));

// ── Declarative card layout ─────────────────────────────
// Flat absolute model: every card declares its home position as an offset
// from the viewport center (centerX, centerY). No cascade — dragging any
// card moves only that card. On resize, cards automatically follow the
// viewport center since home = center + offset.
//
// Offsets were derived from the previous cascade layout evaluated at
// layoutHeight = 820 (the container min-height), then baked as constants.

interface CardSpec {
  /** Export name used by consumers (the `*Position` ref). */
  as: string;
  /** Card name (key into `styles` / drag offsets). */
  name: string;
  /** Horizontal offset from viewport center X (px). Negative = left. */
  xOffset: number;
  /** Vertical offset from viewport center Y (px). Negative = up. */
  yOffset: number;
}

const cardSpecs: CardSpec[] = [
  // ── Left column ──
  {
    as: 'navCardPosition',
    name: 'BentoNavCard',
    xOffset: -352,
    yOffset: -97,
  },
  {
    as: 'techPosition',
    name: 'BentoTech',
    xOffset: -270,
    yOffset: 265,
  },

  // ── Right column ──
  {
    as: 'greetingPosition',
    name: 'BentoMap',
    xOffset: 334,
    yOffset: -279,
  },
  {
    as: 'clockCardPosition',
    name: 'BentoClock',
    xOffset: 318,
    yOffset: -95,
  },
  {
    as: 'calendarPosition',
    name: 'BentoCalendar',
    xOffset: 368,
    yOffset: 145,
  },

  // ── Center column ──
  {
    as: 'picPosition',
    name: 'BentoPic',
    xOffset: 0,
    yOffset: -274,
  },
  {
    as: 'profilePosition',
    name: 'BentoProfileCard',
    xOffset: 0,
    yOffset: 2,
  },
  {
    as: 'listCardPosition',
    name: 'BentoReadingList',
    xOffset: 40,
    yOffset: 248,
  },

  // ── Floating card ──
  {
    as: 'todoCardPosition',
    name: 'TodoCard',
    xOffset: 300,
    yOffset: 329,
  },
];

// ── Layout helpers ──────────────────────────────────────

function px(value: number): string {
  return `${value}px`;
}

/**
 * Convert a card's center point into a top-left style object.
 *
 * Home positions are stored as offsets from the viewport center. To position
 * with `top`/`left` (which the browser treats as the element's top-left
 * corner), we subtract half the card's dimensions.
 *
 * Dimensions come from runtime measurement (via registerCardSize) when
 * available — needed for `w-auto` cards whose width is content-determined.
 * Falls back to the declared `card-styles.json` values for the first paint
 * before measurement lands.
 */
function position(
  centerY: number,
  centerX: number,
  cardName: string,
  cardSizes: Map<string, { width: number; height: number }>,
): CSSProperties {
  const measured = cardSizes.get(cardName);
  const fallback = styles[cardName];
  const w = measured?.width ?? fallback?.width ?? 0;
  const h = measured?.height ?? fallback?.height ?? 0;
  return { top: px(centerY - h / 2), left: px(centerX - w / 2) };
}

/** Create a shallowRef<CSSProperties> that only updates when top/left actually change */
function usePositionRef(source: () => CSSProperties): Ref<CSSProperties> {
  const pos = shallowRef<CSSProperties>(source());

  watch(
    source,
    (next) => {
      if (pos.value.top !== next.top || pos.value.left !== next.left) {
        pos.value = next;
      }
    },
    { flush: 'sync' },
  );

  return pos;
}

// ── Composable ──────────────────────────────────────────

export function useCardLayout(containerRef: Ref<HTMLElement | null>) {
  const { centerX, centerY, containerStyle } = useLayoutCenter(containerRef);
  const layoutStore = useCardLayoutStore();

  const dragY = (name: string) => layoutStore.getOffset(name).y;
  const dragX = (name: string) => layoutStore.getOffset(name).x;

  // ── Runtime-measured card sizes (for centering) ────────
  // Populated by DragWrapper instances via registerCardSize. Needed so the
  // center→top-left conversion in `position()` knows each card's true
  // dimensions — especially `w-auto` cards whose width is content-determined
  // and can't be known from card-styles.json alone.
  const cardSizes = reactive(
    new Map<string, { width: number; height: number }>(),
  );
  const observers = new Map<string, ResizeObserver>();

  function registerCardSize(cardName: string, el: HTMLElement) {
    observers.get(cardName)?.disconnect();
    const measure = () => {
      if (!el.isConnected) return;
      cardSizes.set(cardName, {
        width: el.offsetWidth,
        height: el.offsetHeight,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    observers.set(cardName, ro);
  }

  // Expose registerCardSize to descendant DragWrappers via inject — they call
  // it on mount (and the ResizeObserver re-measures on resize) so this
  // composable can resolve each card's true dimensions for centering.
  provide('cardLayout.registerCardSize', registerCardSize);

  onUnmounted(() => {
    for (const ro of observers.values()) ro.disconnect();
  });

  // ── Flat absolute positioning ──────────────────────────
  // Each card's home position is viewport center + (xOffset, yOffset). Drag
  // offsets are per-card and independent — no cascade, so dragging one card
  // cannot move another.
  const positions: Record<string, Ref<CSSProperties>> = {};
  for (const spec of cardSpecs) {
    positions[spec.as] = usePositionRef(() =>
      position(
        centerY.value + spec.yOffset + dragY(spec.name),
        centerX.value + spec.xOffset + dragX(spec.name),
        spec.name,
        cardSizes,
      ),
    );
  }

  return {
    centerX,
    containerStyle,
    picPosition: positions.picPosition,
    greetingPosition: positions.greetingPosition,
    profilePosition: positions.profilePosition,
    navCardPosition: positions.navCardPosition,
    clockCardPosition: positions.clockCardPosition,
    calendarPosition: positions.calendarPosition,
    techPosition: positions.techPosition,
    listCardPosition: positions.listCardPosition,
    todoCardPosition: positions.todoCardPosition,
    cardStyles: styles,
    cardNamesByOrder,
    maxOrder,
    registerCardSize,
  };
}
