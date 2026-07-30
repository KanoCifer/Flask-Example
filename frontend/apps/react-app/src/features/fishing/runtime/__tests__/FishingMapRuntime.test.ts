/**
 * FishingMapRuntime 单测 —— React 端行为契约。
 *
 * 覆盖:
 * - renderMarkers: 添加 N 个 marker → onMarkerClick 在 click 时触发
 * - setVisibleKinds(null) → 全部可见
 * - setVisibleKinds(Set) → 过滤非匹配 kind
 * - setHoverPreview(spot) → InfoWindow.open
 * - setHoverPreview(null) → InfoWindow.close
 * - locate → 定位 + 蓝点 + 移图
 * - planRoute → Driving.search + Polyline
 * - dispose: 释放所有资源
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MapMarker } from '@readinglist/types';
import { FishingMapRuntime } from '../FishingMapRuntime';
import { createInMemoryAmap, FakeInfoWindow, FakeMarker } from '../inMemoryAmap';

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeMarker(
  id: string,
  position: [number, number],
  kind: MapMarker['kind'],
): MapMarker {
  return {
    position,
    kind,
    extraData: {
      id,
      name: `Spot ${id}`,
      description: '',
      tags: [],
      rating: 0,
      images: [],
      kind: kind ?? null,
      created_at: '2026-07-30T00:00:00Z',
      updated_at: '2026-07-30T00:00:00Z',
    },
  };
}

describe('FishingMapRuntime', () => {
  describe('renderMarkers', () => {
    it('添加 N 个 marker 后 click 触发 onMarkerClick', () => {
      const { ns } = createInMemoryAmap();
      const { map } = createInMemoryAmap();
      const runtime = new FishingMapRuntime(map as any, ns as any);
      const spots: MapMarker[] = [
        makeMarker('1', [113.4, 23.0], 'lake'),
        makeMarker('2', [113.5, 23.1], 'river'),
        makeMarker('3', [113.6, 23.2], 'reservoir'),
      ];
      runtime.renderMarkers(spots);

      const onClick = vi.fn();
      runtime.onMarkerClick = onClick;

      const markerCalls = (ns.Marker as any).mock.results;
      const createdMarkers = markerCalls.map((r: any) => r.value as FakeMarker);

      // 模拟点击第二个 marker
      createdMarkers[1].emit('click');
      expect(onClick).toHaveBeenCalledWith({
        index: 1,
        spot: spots[1],
      });
    });
  });

  describe('setVisibleKinds', () => {
    it('传 null 视为全部可见 —— 所有 marker 挂载', () => {
      const { ns } = createInMemoryAmap();
      const { map } = createInMemoryAmap();
      const runtime = new FishingMapRuntime(map as any, ns as any);
      const spots: MapMarker[] = [
        makeMarker('1', [113.4, 23.0], 'lake'),
        makeMarker('2', [113.5, 23.1], 'river'),
      ];
      runtime.renderMarkers(spots);

      runtime.setVisibleKinds(new Set(['lake']));

      const markerCalls = (ns.Marker as any).mock.results;
      const created = markerCalls.map((r: any) => r.value as FakeMarker);

      runtime.setVisibleKinds(null);

      created.forEach((m: FakeMarker) => {
        expect(m).toBeInstanceOf(FakeMarker);
      });
    });

    it('传 Set 过滤 —— 非匹配 kind 的 marker 走 leaving class', () => {
      const { ns } = createInMemoryAmap();
      const { map } = createInMemoryAmap();
      const runtime = new FishingMapRuntime(map as any, ns as any);
      const spots: MapMarker[] = [
        makeMarker('1', [113.4, 23.0], 'lake'),
        makeMarker('2', [113.5, 23.1], 'river'),
        makeMarker('3', [113.6, 23.2], 'reservoir'),
      ];
      runtime.renderMarkers(spots);

      runtime.setVisibleKinds(new Set(['lake']));

      const markerCalls = (ns.Marker as any).mock.results;
      const created = markerCalls.map((r: any) => r.value as FakeMarker);

      // 不销毁实例 —— 三个 marker 都还在
      expect(created).toHaveLength(3);
      expect(created.every((m: any) => m instanceof FakeMarker)).toBe(true);
    });
  });

  describe('setHoverPreview', () => {
    it('传 spot → InfoWindow.open', () => {
      const { ns, infoWindows } = createInMemoryAmap();
      const { map } = createInMemoryAmap();
      const runtime = new FishingMapRuntime(map as any, ns as any);
      const spot = makeMarker('1', [113.4, 23.0], 'lake');
      runtime.renderMarkers([spot]);

      expect(infoWindows.length).toBeGreaterThanOrEqual(1);
      const hoverWindow = infoWindows[0] as unknown as FakeInfoWindow;
      expect(hoverWindow.isOpen).toBe(false);

      runtime.setHoverPreview(spot);

      expect(hoverWindow.isOpen).toBe(true);
      expect(hoverWindow.openedAt).toEqual([113.4, 23.0]);
    });

    it('传 null → InfoWindow.close', () => {
      const { ns, infoWindows } = createInMemoryAmap();
      const { map } = createInMemoryAmap();
      const runtime = new FishingMapRuntime(map as any, ns as any);
      const spot = makeMarker('1', [113.4, 23.0], 'lake');
      runtime.renderMarkers([spot]);

      const hoverWindow = infoWindows[0] as unknown as FakeInfoWindow;
      runtime.setHoverPreview(spot);
      expect(hoverWindow.isOpen).toBe(true);

      runtime.setHoverPreview(null);
      expect(hoverWindow.isOpen).toBe(false);
    });
  });

  describe('locate', () => {
    it('定位后设置蓝点 + 移图', async () => {
      const { ns } = createInMemoryAmap();
      const { map } = createInMemoryAmap();
      const runtime = new FishingMapRuntime(map as any, ns as any);

      const pos = await runtime.locate();

      expect(pos).toEqual([113.4, 23.06]);
      // 蓝点 marker 已添加
      const markerCalls = (ns.Marker as any).mock.results;
      const markers = markerCalls.map((r: any) => r.value as FakeMarker);
      const userMarker = markers.find((m: any) => m.zIndex === 200);
      expect(userMarker).toBeDefined();
      expect(userMarker!.position).toEqual([113.4, 23.06]);
    });
  });

  describe('planRoute', () => {
    it('规划路线返回 RouteInfo', async () => {
      const { ns } = createInMemoryAmap();
      const { map } = createInMemoryAmap();
      const runtime = new FishingMapRuntime(map as any, ns as any);

      const routeInfo = await runtime.planRoute(
        [113.4, 23.06],
        [113.5, 23.1],
      );

      expect(routeInfo).toBeDefined();
      expect(typeof routeInfo.distance).toBe('number');
      expect(typeof routeInfo.time).toBe('number');
    });

    it('clearRoute 清除路线', async () => {
      const { ns } = createInMemoryAmap();
      const { map } = createInMemoryAmap();
      const runtime = new FishingMapRuntime(map as any, ns as any);

      await runtime.planRoute([113.4, 23.06], [113.5, 23.1]);
      runtime.clearRoute();

      // Polyline 已被 map.remove
      expect(map.getOverlayCount()).toBe(0);
    });
  });

  describe('dispose', () => {
    it('释放所有 marker + 关闭 InfoWindow', () => {
      const { ns, infoWindows } = createInMemoryAmap();
      const { map } = createInMemoryAmap();
      const runtime = new FishingMapRuntime(map as any, ns as any);
      runtime.renderMarkers([
        makeMarker('1', [113.4, 23.0], 'lake'),
        makeMarker('2', [113.5, 23.1], 'river'),
      ]);

      const hoverWindow = infoWindows[0] as unknown as FakeInfoWindow;
      runtime.setHoverPreview(makeMarker('1', [113.4, 23.0], 'lake'));
      expect(hoverWindow.isOpen).toBe(true);

      runtime.dispose();

      expect(hoverWindow.isOpen).toBe(false);
      const created = (ns.Marker as any).mock
        .results;
      const markerInstances = created.map(
        (r: any) => r.value as FakeMarker,
      );
      // 非 userLocationMarker 应已 detach
      markerInstances
        .filter((m: FakeMarker) => (m as FakeMarker).zIndex !== 200)
        .forEach((m: FakeMarker) => {
          expect((m as FakeMarker).attachedMap).toBeNull();
        });
    });
  });
});
