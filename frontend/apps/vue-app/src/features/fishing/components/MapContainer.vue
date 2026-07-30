<template>
  <!-- 地图实例 -->
  <div ref="containerRef" class="map-container relative">
    <!-- 添加钓点按钮 -->
    <button
      type="button"
      class="bg-secondary/90 text-ink hover:bg-accent absolute right-2.5 bottom-20 z-60 flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm transition-all duration-200 ease-out active:scale-95"
      aria-label="添加钓点"
      @click="emit('addSpot')"
    >
      <Plus class="text-ink h-5 w-5" />
    </button>

    <!-- 定位按钮：浏览器原生方式获取 -->
    <button
      type="button"
      :class="[
        'bg-page/90 text-ink hover:bg-page /40 absolute right-2.5 bottom-5 z-60 flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm backdrop-blur-md transition-all duration-200 ease-out active:scale-95 disabled:opacity-50',
        isLocating && 'text-ink',
      ]"
      :disabled="isLocating"
      aria-label="定位到当前位置"
      @click="handleLocateClick"
    >
      <!-- 图标交叉淡入淡出(非 motion 库:cubic-bezier 过渡 + 缩放 + 模糊) -->
      <span
        class="icon-crossfade"
        :class="{ 'is-active': isLocating }"
        aria-hidden="true"
      >
        <Locate
          class="icon-crossfade__item icon-crossfade__item--enter h-4 w-4"
        />
        <Loader2
          class="icon-crossfade__item icon-crossfade__item--exit h-4 w-4"
        />
      </span>
    </button>

    <p
      class="text-muted/90 bg-page/70 absolute bottom-20 left-1/2 -translate-x-1/2 rounded-full px-4 py-1.5 text-xs backdrop-blur-md"
    >
      点击地图标记，查看钓点信息
    </p>
  </div>
</template>

<script setup lang="ts">
import { Loader2, Locate, Plus } from '@lucide/vue';
import type { FishingSpotKind, MapMarker } from '@readinglist/types';
import type { MarkerClickPayload } from '@/features/fishing/composables/fishingMapRuntime';
import { loadAMapNamespace } from '@/features/fishing/composables/amapNamespace';
import { FishingMapRuntime } from '@/features/fishing/composables/fishingMapRuntime';
import type { FishingMapInstance } from '@/features/fishing/composables/useFishingRoute';
import { DEFAULT_MAP_CENTER } from '@/features/fishing/stores/fishingMap';
import { onMounted, onUnmounted, ref, watch, useTemplateRef } from 'vue';

declare global {
  interface Window {
    _AMapSecurityConfig: { securityJsCode: string };
  }
}

/*
 * MapContainer 现在是浅组件:只负责容器 DOM、AMap 加载与 map 实例生命周期。
 * 所有行为(标记 / 定位 / kind 过滤 / hover preview)下沉到 FishingMapRuntime,
 * 经 FishingMapInstance 接口暴露,可注入 in-memory AMap 引擎测试。
 *
 * 路线规划已下线(task-279 / task-282 一并清理):marker 不再有 Driving 浮层,
 * 详情面板内联「打开高德 App」即可。
 */

const containerRef = useTemplateRef<HTMLDivElement>('containerRef');

interface Props {
  markers?: MapMarker[];
  /**
   * 可见的 kind 集合(任务 284 chip 选择器驱动)。
   * null / 空 Set = 全部可见。null kind 的 marker 在 kinds 非空时也视为不可见。
   */
  visibleKinds?: Set<FishingSpotKind> | null;
  /** 当前 hover 的 marker(任务 284 列表 hover 同步驱动 InfoWindow) */
  hoveredMarker?: MapMarker | null;
}

const props = withDefaults(defineProps<Props>(), {
  markers: () => [],
  visibleKinds: null,
  hoveredMarker: null,
});

const emit = defineEmits<{
  (e: 'click', event: unknown): void;
  (e: 'markerClick', payload: MarkerClickPayload): void;
  (e: 'mapReady'): void;
  (e: 'error', message: string): void;
  (e: 'addSpot'): void;
}>();

let map: AMap.Map | null = null;
let runtime: FishingMapRuntime | null = null;
let clickHandler: ((e: unknown) => void) | null = null;

const isLocating = ref(false);

onMounted(async () => {
  try {
    const AMap = await loadAMapNamespace();
    if (!containerRef.value) return;

    map = new AMap.Map(containerRef.value, {
      viewMode: '2D',
      zoom: 11,
      center: DEFAULT_MAP_CENTER,
      layers: [new AMap.TileLayer.Satellite()],
      mapStyle: 'amap://styles/normal',
    });

    map.addControl(new AMap.ToolBar({ position: 'RT' }));
    map.addControl(new AMap.Scale());

    // 行为下沉到 runtime;map 实例由本组件持有,卸载时销毁
    runtime = new FishingMapRuntime(map, AMap);
    runtime.onMarkerClick = (payload) => emit('markerClick', payload);
    runtime.renderMarkers(props.markers);
    // 初始化可见性
    if (props.visibleKinds) {
      runtime.setVisibleKinds(props.visibleKinds);
    }

    clickHandler = (e: unknown) => emit('click', e);
    map.on('click', clickHandler);

    emit('mapReady');
  } catch (e: unknown) {
    console.error('AMap loading error:', e);
  }
});

// 监听标记点变化
watch(
  () => props.markers,
  () => {
    runtime?.renderMarkers(props.markers);
    // 重渲染后立即应用可见性,避免刚加进来的 marker 闪一下又消失
    if (props.visibleKinds) {
      runtime?.setVisibleKinds(props.visibleKinds);
    }
  },
  { deep: true },
);

// 监听 kind 过滤变化
watch(
  () => props.visibleKinds,
  (kinds) => {
    runtime?.setVisibleKinds(kinds ?? null);
  },
);

// 监听 hover preview 变化(列表 hover → 同步 InfoWindow)
watch(
  () => props.hoveredMarker,
  (marker) => {
    runtime?.setHoverPreview(marker ?? null);
  },
);

// 定位:runtime 解析位置 → setCenter + 打点。失败走 IP 兜底(静默),都失败才通知。
// 初始化(onMapReady)与按钮点击共用;按钮可重试。
// 返回坐标供调用方复用,避免重复触发定位。
const locate = async (): Promise<[number, number] | null> => {
  if (!map || !runtime) return null;
  isLocating.value = true;
  try {
    const [lng, lat] = await runtime.getCurrentPosition();
    if (!map) return null;
    map.setCenter([lng, lat]);
    map.setZoom(15);
    runtime.showUserLocationMarker(lng, lat);
    return [lng, lat];
  } catch (e) {
    // IP 兜底已在 runtime 内部处理(成功则静默);都失败才通知
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('定位失败:', msg);
    emit('error', `定位失败: ${msg}`);
    return null;
  } finally {
    isLocating.value = false;
  }
};

// 定位按钮点击:可重试定位
const handleLocateClick = () => void locate();

// 暴露行为接口给父组件(经 FishingMapInstance 类型约束)
defineExpose<FishingMapInstance>({
  getCurrentPosition: () => {
    if (!runtime) return Promise.reject(new Error('地图未就绪'));
    return runtime.getCurrentPosition();
  },
  setZoomAndCenter: (zoom, center) => {
    if (!runtime) return;
    runtime.setZoomAndCenter(zoom, center);
  },
  /** 定位:移图 + 打点,返回坐标供调用方复用。初始化自动定位与按钮重试共用 */
  locate,
  /** kind 过滤 —— null / 空 Set = 全部可见 */
  setVisibleKinds: (kinds) => runtime?.setVisibleKinds(kinds),
  /** hover preview —— AMap.InfoWindow;null = 关闭 */
  setHoverPreview: (spot) => runtime?.setHoverPreview(spot),
});

onUnmounted(() => {
  runtime?.dispose();
  runtime = null;

  if (map && clickHandler) {
    map.off('click', clickHandler);
    clickHandler = null;
  }

  if (map) {
    map.destroy();
    map = null;
  }

  if (containerRef.value) {
    containerRef.value.innerHTML = '';
  }
});
</script>

<style scoped>
.map-container {
  padding: 0px;
  margin: 0px;
  width: 100%;
  height: 100%;
}

/*
 * 鱼形 marker 的过渡(任务 282):
 * - 默认态:opacity 1,scale 1(基线)
 * - 隐藏中(--leaving):opacity 0,scale 0.6;200ms 过渡后由 runtime setMap(null)
 * - 重新可见(--visible):触发过渡回到默认态
 *
 * 类切换由 runtime.setVisibleKinds 控制(JS 直接操作 classList)。
 * transition 同时跑 opacity + transform —— 任务 282 要求 200ms。
 */
.fish-marker {
  transition:
    opacity 200ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
  opacity: 1;
}
.fish-marker:focus-visible {
  /* 键盘聚焦时给个高亮描边,让 Tab/Shift+Tab 导航可见 */
  outline: 2px solid var(--accent, currentColor);
  outline-offset: 2px;
}
.fish-marker--leaving {
  opacity: 0;
  transform: rotate(-45deg) scale(0.6);
}
.fish-marker--visible {
  opacity: 1;
  transform: rotate(-45deg) scale(1);
}

/*
 * 图标交叉淡入淡出 —— 无 motion 库时用 CSS 过渡模仿 (principle #7)
 * 默认态:enter 图标显示 / exit 图标隐藏;is-active 翻转
 * cubic-bezier(0.2, 0, 0, 1) 提供 enter 与 exit 双向动画
 */
.icon-crossfade {
  position: relative;
  display: inline-flex;
  width: 1rem;
  height: 1rem;
}
.icon-crossfade__item {
  position: absolute;
  inset: 0;
  margin: auto;
  transition:
    opacity 200ms cubic-bezier(0.2, 0, 0, 1),
    transform 200ms cubic-bezier(0.2, 0, 0, 1),
    filter 200ms cubic-bezier(0.2, 0, 0, 1);
}
.icon-crossfade__item--enter {
  opacity: 1;
  transform: scale(1);
  filter: blur(0);
}
.icon-crossfade__item--exit {
  opacity: 0;
  transform: scale(0.25);
  filter: blur(4px);
}
.icon-crossfade.is-active .icon-crossfade__item--enter {
  opacity: 0;
  transform: scale(0.25);
  filter: blur(4px);
}
.icon-crossfade.is-active .icon-crossfade__item--exit {
  opacity: 1;
  transform: scale(1);
  filter: blur(0);
}
.icon-crossfade.is-active .icon-crossfade__item--exit.animate-spin {
  animation: spin 1s linear infinite;
}

/*
 * InfoWindow preview card —— AMap 把内容塞到 amap-info-content 容器下(脱离本组件作用域),
 * 用 :deep 命中 fish-preview-card 子级,接管字体 / 微阴影。
 * 业务颜色(--ink / --page / --muted)走主题 token。
 */
:deep(.fish-preview-card) {
  /* 让工具栏、版权水印不出现在预览窗上 */
  border: 1px solid color-mix(in oklch, var(--ink) 12%, transparent);
}
:deep(.amap-info-content) {
  padding: 0;
  background: transparent;
  box-shadow: none;
}
:deep(.amap-info-close) {
  /* 关闭 × 走主题色 */
  color: var(--ink, currentColor);
}
</style>
