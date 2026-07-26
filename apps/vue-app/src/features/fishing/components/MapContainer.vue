<template>
  <Teleport to="body" :disabled="!isFullscreen">
    <div
      :class="[
        isFullscreen
          ? 'fixed inset-0 overflow-hidden'
          : 'relative h-full w-full',
      ]"
    >
      <!-- 地图实例 -->
      <div ref="containerRef" class="map-container shadow-md"></div>

      <!-- 添加钓点按钮 -->
      <button
        type="button"
        class="bg-secondary/90 text-ink hover:bg-accent absolute right-2.5 bottom-36 z-60 flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm transition-all duration-200 ease-out active:scale-95"
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

      <!-- 地图全屏按钮 -->
      <button
        type="button"
        class="bg-page/90 text-ink hover:bg-page /40 absolute right-2.5 bottom-20 z-60 flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm backdrop-blur-md transition-all duration-200 ease-out active:scale-95 disabled:opacity-50"
        @click="handleFullscreen"
      >
        <span
          class="icon-crossfade"
          :class="{ 'is-active': isFullscreen }"
          aria-hidden="true"
        >
          <Maximize
            class="icon-crossfade__item icon-crossfade__item--enter h-4 w-4"
          />
          <Minimize
            class="icon-crossfade__item icon-crossfade__item--exit h-4 w-4"
          />
        </span>
      </button>

      <!-- 路线浮层（原 MapTile 折叠进来） -->
      <SlideFadeTransitionX
        enter-from-class="opacity-0 translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-2"
      >
        <div
          v-if="isPlanning || routeInfo"
          class="bg-page/90 absolute right-4 bottom-4 left-4 mx-auto w-fit rounded-2xl border p-4 shadow-lg backdrop-blur-md"
        >
          <div v-if="isPlanning" class="text-muted flex items-center gap-3">
            <Loader2 class="h-4 w-4 animate-spin" />
            <span class="text-sm">正在规划路线...</span>
          </div>
          <div
            v-else-if="routeInfo"
            class="flex items-center justify-between gap-4"
          >
            <div class="space-y-1.5">
              <p class="text-muted text-xs tracking-[0.2em] uppercase">
                路线信息
              </p>
              <p
                class="text-ink font-family-averia text-2xl leading-none tabular-nums sm:text-3xl"
              >
                <span>{{ formatDistance(routeInfo.distance) }}</span>
                <span class="text-muted mx-2 text-base">·</span>
                <span>{{ formatDuration(routeInfo.time) }}</span>
              </p>
            </div>
            <button
              class="bg-destructive text-ink hover:bg-destructive/90 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              type="button"
              @click="emit('clearRoute')"
            >
              清除路线
            </button>
          </div>
        </div>
      </SlideFadeTransitionX>

      <p
        v-if="!isPlanning && !routeInfo"
        class="text-muted/90 bg-page/70 absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full px-4 py-1.5 text-xs backdrop-blur-md"
      >
        点击地图标记，查看钓点信息
      </p>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { Loader2, Locate, Maximize, Minimize, Plus } from '@lucide/vue';
import type { MapMarker } from '@/features/fishing/types';
import type { MarkerClickPayload } from '@/features/fishing/composables/fishingMapRuntime';
import { loadAMapNamespace } from '@/features/fishing/composables/amapNamespace';
import { FishingMapRuntime } from '@/features/fishing/composables/fishingMapRuntime';
import {
  formatDistance,
  type FishingMapInstance,
  type RouteInfo,
} from '@/features/fishing/composables/useFishingRoute';
import { formatDuration } from '@/lib/dayjs';
import { SlideFadeTransitionX } from '@/components';
import { DEFAULT_MAP_CENTER } from '@/features/fishing/stores/fishingMap';
import {
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
  useTemplateRef,
} from 'vue';

declare global {
  interface Window {
    _AMapSecurityConfig: { securityJsCode: string };
  }
}

/*
 * MapContainer 现在是浅组件:只负责容器 DOM、AMap 加载与 map 实例生命周期。
 * 所有行为(标记 / 路线 / 定位)下沉到 FishingMapRuntime,经 FishingMapInstance
 * 接口暴露,可注入 in-memory AMap 引擎测试。
 */

const containerRef = useTemplateRef<HTMLDivElement>('containerRef');

interface Props {
  markers?: MapMarker[];
  /** 路线浮层状态(由 dashboard 的 useFishingRoute 驱动) */
  isPlanning?: boolean;
  routeInfo?: RouteInfo | null;
}

const props = withDefaults(defineProps<Props>(), {
  markers: () => [],
  isPlanning: false,
  routeInfo: null,
});

const emit = defineEmits<{
  (e: 'click', event: unknown): void;
  (e: 'markerClick', payload: MarkerClickPayload): void;
  (e: 'mapReady'): void;
  (e: 'error', message: string): void;
  (e: 'clearRoute'): void;
  (e: 'addSpot'): void;
}>();

let map: AMap.Map | null = null;
let runtime: FishingMapRuntime | null = null;
let clickHandler: ((e: unknown) => void) | null = null;

const isLocating = ref(false);
const isFullscreen = ref(false);

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
  },
  { deep: true },
);

// 全屏按钮点击:Teleport 后容器被重新挂载,AMap 不会自动重新测量尺寸
watch(isFullscreen, async () => {
  await nextTick();
  if (map) {
    runtime?.resize();
  }
});

const handleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value;
};

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

// 暴露行为接口给父组件（经 FishingMapInstance 类型约束）
defineExpose<FishingMapInstance>({
  planRoute: (start, end): Promise<RouteInfo> => {
    if (!runtime) return Promise.reject(new Error('地图未就绪'));
    return runtime.planRoute(start, end);
  },
  clearRoute: () => runtime?.clearRoute(),
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
</style>
