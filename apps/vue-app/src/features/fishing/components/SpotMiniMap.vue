<script setup lang="ts">
/**
 * SpotMiniMap —— 钓点位置示意 / 选点迷你地图。
 *
 * 两种模式(由 interactive 道具切换):
 * - 静态(默认):单标记、无交互(缩放/拖拽/滚轮全部禁用),仅作位置示意。
 *   SpotDetailPanel 用法,保持不变。
 * - 交互:允许缩放 / 拖拽 / 点击;点击地图放置 / 移动图钉,emit update:position。
 *   SpotFormPanel 添加钓点小地图用法。
 *
 * 复用主地图的 loadAMapNamespace(脚本已缓存,二次调用直接返回)与标记 SVG。
 */
import { loadAMapNamespace } from '@/features/fishing/composables/amapNamespace';
import { FISHING_MARKER_CONTENT } from '@/features/fishing/composables/fishingMapRuntime';
import { DEFAULT_MAP_CENTER } from '@/features/fishing/stores/fishingMap';
import { onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    /** 图钉位置;交互模式下初始未选点时可省略 */
    position?: [number, number];
    /** 钓点名称(标记 title / aria);无名称可省略 */
    name?: string;
    /** 地图中心(交互模式初始聚焦位置);默认取 position → DEFAULT_MAP_CENTER */
    center?: [number, number];
    /** 交互模式:允许点击选点 / 缩放 / 拖拽 */
    interactive?: boolean;
  }>(),
  { name: '', interactive: false },
);

const emit = defineEmits<{
  (e: 'update:position', position: [number, number]): void;
}>();

const container = ref<HTMLDivElement | null>(null);
let map: AMap.Map | null = null;
let marker: AMap.Marker | null = null;

/** 交互模式:点击地图 → 放置 / 移动图钉 + 抛出坐标 */
function handleMapClick(e: unknown): void {
  const lnglat = (
    e as { lnglat: { getLng: () => number; getLat: () => number } }
  ).lnglat;
  const pos: [number, number] = [lnglat.getLng(), lnglat.getLat()];
  if (marker) {
    marker.setPosition(pos);
  } else if (map) {
    marker = new AMap.Marker({
      position: pos,
      content: FISHING_MARKER_CONTENT,
      offset: new AMap.Pixel(-13, -30),
    });
    marker.setMap(map);
  }
  emit('update:position', pos);
}

onMounted(async () => {
  try {
    const AMap = await loadAMapNamespace();
    if (!container.value) return;

    const _center = props.center ?? props.position ?? DEFAULT_MAP_CENTER;
    const _interactive = props.interactive;

    map = new AMap.Map(container.value, {
      zoom: 14,
      center: _center,
      zoomEnable: _interactive,
      dragEnable: _interactive,
      doubleClickZoom: _interactive,
      scrollWheel: _interactive,
      touchZoom: _interactive,
      keyboardEnable: false,
      mapStyle: 'amap://styles/normal',
    });

    if (props.position) {
      marker = new AMap.Marker({
        position: props.position,
        content: FISHING_MARKER_CONTENT,
        offset: new AMap.Pixel(-13, -30),
      });
      marker.setMap(map);
    }

    if (_interactive) {
      map.on('click', handleMapClick);
    }

    // 面板滑入动画结束后重新测量,避免灰块(runtime 方法,类型未声明)
    setTimeout(
      () => (map as unknown as { resize: () => void } | null)?.resize(),
      360,
    );
  } catch (e) {
    console.error('迷你地图加载失败:', e);
  }
});

// 位置 prop 变化:重新居中,并按需创建 / 移动图钉(组件不重新挂载,只更新 props)
watch(
  () => props.position,
  (pos) => {
    if (!map || !pos) return;
    map.setZoomAndCenter(14, pos);
    if (marker) {
      marker.setPosition(pos);
    } else {
      marker = new AMap.Marker({
        position: pos,
        content: FISHING_MARKER_CONTENT,
        offset: new AMap.Pixel(-13, -30),
      });
      marker.setMap(map);
    }
  },
);

onBeforeUnmount(() => {
  if (map) map.off('click', handleMapClick);
});

onUnmounted(() => {
  if (container.value) container.value.innerHTML = '';
  marker = null;
  map?.destroy();
  map = null;
});
</script>

<template>
  <div class="relative h-45 w-full overflow-hidden rounded-2xl">
    <div ref="container" class="map-container" />
    <!-- 交互模式选点提示(未选点时居中显示) -->
    <div
      v-if="interactive && !position"
      class="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <span
        class="bg-page/80 text-muted rounded-full px-3 py-1.5 text-xs shadow-sm backdrop-blur-sm"
      >
        点击地图放置钓点
      </span>
    </div>
  </div>
</template>

<style scoped>
.map-container {
  padding: 0px;
  margin: 0px;
  width: 100%;
  height: 100%;
}
:deep(.amap-logo) {
  transform: scale(0.7);
  opacity: 0.55;
}
:deep(.amap-copyright) {
  bottom: 0 !important;
  font-size: 8px !important;
  line-height: 1;
  opacity: 0.5;
  pointer-events: none;
}
</style>
