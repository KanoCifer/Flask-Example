/**
 * FishingMap —— 全屏地图 + 持久 DashboardSheet + 三层 BottomSheet 浮层。
 *
 * 层次:
 *   z-0   FishingMapTile         (fixed inset-0, AMap 容器)
 *   z-30  DashboardSheet         (持久, 可拖拽吸附 collapsed/half/full)
 *   z-200 BottomSheet (analysis / feedback / detail) 打开时盖在 DashboardSheet 上
 *
 * 路线状态 UI 全部上移至 DashboardSheet 顶部的 RouteBanner,
 * FishingMapTile 只承载地图本身 + marker, 没有内嵌浮层。
 */
import { useCallback, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { motion, useReducedMotion } from 'framer-motion';

import { useFishingMapStore } from '@/features/fishing/stores/fishingMapStore';
import { useRouteMapStore } from '@/stores/routeMapStore';

import './fishingMap.css';

import { DashboardSheet } from './components/DashboardSheet';
import { FishingAnalysisDrawer } from './components/FishingAnalysisDrawer';
import { FishingFeedbackForm } from './components/FishingFeedbackForm';
import { FishingIndexCard } from './components/FishingIndexCard';
import { FishingIndexDetailSheet } from './components/FishingIndexDetailSheet';
import { FishingMapTile } from './components/FishingMapTile';
import { FishingSpotDetailSheet } from './components/FishingSpotDetailSheet';
import { HourlyWeather } from './components/HourlyWeather';
import { QuickFeedbackBanner } from './components/QuickFeedbackBanner';
import { RouteBanner } from './components/RouteBanner';
import { TideCard } from './components/TideCard';
import { WeatherCard } from './components/WeatherCard';
import { WeatherHero } from './components/WeatherHero';
import { MAP_CENTER } from './constants';
import { AnalysisContextProvider } from './contexts/AnalysisContext';
import { useFishingAnalysis } from './hooks/useFishingAnalysis';
import { useFishingFeedback } from './hooks/useFishingFeedback';
import type { MapMarker } from '@/types/marker';
import type { FishingIndexData } from './types';

export default function FishingMap() {
  return (
    <AnalysisContextProvider>
      <FishingMapContent />
    </AnalysisContextProvider>
  );
}

function FishingMapContent() {
  const prefersReduced = useReducedMotion();

  // —— 状态聚合：三个 hook 接管 view 里所有派生状态 ——
  const analysis = useFishingAnalysis();
  const feedback = useFishingFeedback();

  const { userPosition, isPlanningRoute, routeInfo } = useRouteMapStore(
    useShallow((s) => ({
      userPosition: s.userPosition,
      isPlanningRoute: s.isPlanningRoute,
      routeInfo: s.routeInfo,
    })),
  );

  const fetchWeatherAndFishing = useFishingMapStore(
    (s) => s.fetchWeatherAndFishing,
  );
  const indexData = useFishingMapStore((s) => s.indexData);
  const markers = useFishingMapStore((s) => s.markers);
  const setMarkers = useFishingMapStore((s) => s.setMarkers);

  // —— 钓点详情 sheet 状态 ——
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);

  const handleMarkerSelect = useCallback((marker: MapMarker) => {
    setSelectedMarker(marker);
  }, []);

  const handleSpotClose = useCallback(() => {
    setSelectedMarker(null);
  }, []);

  const handleSpotRoute = useCallback((marker: MapMarker) => {
    // 关闭详情，交由地图规划路线（当前为 stub，保留扩展点）
    setSelectedMarker(null);
    void marker;
  }, []);

  const handleSpotUpdated = useCallback(
    (marker: MapMarker) => {
      setSelectedMarker(marker);
      // 同步地图标记源数据
      setMarkers((prev) =>
        prev.map((m) =>
          m.extraData && marker.extraData
            ? (m.extraData as { id?: string }).id ===
              (marker.extraData as { id?: string }).id
              ? marker
              : m
            : m,
        ),
      );
    },
    [setMarkers],
  );

  const handleSpotDeleted = useCallback(
    (id: string) => {
      setMarkers((prev) =>
        prev.filter(
          (m) => (m.extraData as { id?: string | undefined }).id !== id,
        ),
      );
    },
    [setMarkers],
  );

  // —— 详情 sheet 状态 ——
  const [detailSheet, setDetailSheet] = useState<{
    open: boolean;
    data: FishingIndexData | null;
  }>({ open: false, data: null });

  // —— 副作用：用户定位到位后拉数据；初始按地图中心拉 ——
  useEffect(() => {
    if (userPosition) {
      void fetchWeatherAndFishing(userPosition);
    }
  }, [userPosition, fetchWeatherAndFishing]);

  useEffect(() => {
    void fetchWeatherAndFishing(MAP_CENTER);
  }, [fetchWeatherAndFishing]);

  // —— 启动时拉钓点数据 ——
  const fetchSpots = useFishingMapStore((s) => s.fetchSpots);
  useEffect(() => {
    void fetchSpots();
  }, [fetchSpots]);

  const showFeedbackBanner = !isPlanningRoute && !routeInfo;

  const handleFeedbackClick = useCallback(
    (data: FishingIndexData) => {
      feedback.openFeedback(data, null);
    },
    [feedback],
  );

  const handleQuickFeedback = useCallback(() => {
    if (!indexData) return;
    feedback.openFeedback(indexData, null);
  }, [feedback, indexData]);

  const handleDetailClick = useCallback((data: FishingIndexData) => {
    setDetailSheet({ open: true, data });
  }, []);

  const handleDetailClose = useCallback(() => {
    setDetailSheet((prev) => ({ ...prev, open: false }));
  }, []);

  const handleClearRoute = useCallback(() => {
    useRouteMapStore.getState().clearRoute();
  }, []);

  // —— 一次编排的入场 (Apple: 内容一次落定, 非逐段 fade-on-scroll) ——
  const container = {
    hidden: {},
    show: {
      transition: { staggerChildren: 0.05, delayChildren: 0.08 },
    },
  };
  const item = prefersReduced
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 10 },
        show: {
          opacity: 1,
          y: 0,
          transition: {
            duration: 0.4,
            ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
          },
        },
      };

  return (
    <div className="bg-page min-h-screen">
      {/* Map — fixed full-screen background */}
      <FishingMapTile
        markers={markers}
        onMarkerSelect={handleMarkerSelect}
        focusedLocation={selectedMarker?.position ?? null}
      />

      {/* Persistent DashboardSheet — draggable between collapsed / half / full */}
      <DashboardSheet>
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="mx-auto w-full max-w-xl px-4 pt-1 pb-2"
        >
          {/* Route banner — sits at top of sheet so it stays visible in any snap */}
          <motion.div variants={item} className="mb-2">
            <RouteBanner onClearRoute={handleClearRoute} />
          </motion.div>

          {/* Hero — flat surface */}
          <motion.div variants={item}>
            <WeatherHero
              analysisOpen={analysis.open}
              analysisHasData={analysis.hasData}
              onToggleAnalysis={analysis.toggle}
            />
          </motion.div>

          {/* iOS Weather rhythm: hairline-suggested sections, varied gap */}
          <motion.div variants={item} className="mt-2">
            <FishingIndexCard
              location={userPosition ?? MAP_CENTER}
              onFeedbackClick={handleFeedbackClick}
              onDetailClick={handleDetailClick}
            />
          </motion.div>

          {showFeedbackBanner && (
            <motion.div variants={item} className="mt-6">
              <QuickFeedbackBanner
                visible={showFeedbackBanner}
                disabled={!indexData}
                onSubmit={handleQuickFeedback}
              />
            </motion.div>
          )}

          <motion.div variants={item} className="mt-6">
            <WeatherCard location={userPosition ?? MAP_CENTER} />
          </motion.div>

          <motion.div variants={item} className="mt-6">
            <TideCard />
          </motion.div>

          <motion.div variants={item} className="mt-6">
            <HourlyWeather />
          </motion.div>

          {/* Closing line — literary voice stays */}
          <p className="text-muted/60 font-family-averia mt-10 text-center text-xs italic">
            在出钓与阅读之间，留一片安静
          </p>
        </motion.div>
      </DashboardSheet>

      {feedback.currentFishingData && (
        <FishingFeedbackForm
          open={feedback.open}
          fishingData={feedback.currentFishingData}
          locationId={feedback.locationId}
          locationName={feedback.locationName}
          onSuccess={feedback.closeFeedback}
          onCancel={feedback.closeFeedback}
        />
      )}

      <FishingAnalysisDrawer
        open={analysis.open}
        onClose={analysis.close}
        onGenerate={analysis.generateAnalysis}
      />

      <FishingIndexDetailSheet
        open={detailSheet.open}
        data={detailSheet.data}
        onClose={handleDetailClose}
      />

      <FishingSpotDetailSheet
        open={selectedMarker !== null}
        marker={selectedMarker}
        onClose={handleSpotClose}
        onRoute={handleSpotRoute}
        onSpotUpdated={handleSpotUpdated}
        onSpotDeleted={handleSpotDeleted}
      />
    </div>
  );
}
