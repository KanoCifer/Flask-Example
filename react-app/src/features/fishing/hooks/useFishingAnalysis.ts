/**
 * AI 天气分析抽屉的状态聚合。
 *
 * 职责:
 * - 维护 drawer 开关
 * - 从 store 拼装 WeatherAnalysisPayload (live / forecasts / tide / index / location)
 * - 编排 generateAnalysis 流: 串起 service.generateAnalysis + context 状态 + abort controller
 *
 * 抽出原因: 原本散落在 FishingMap.tsx 的 useState 与派生 payload,
 * 以及 AnalysisContent 的 generate 逻辑 (该组件已删除), 现在统一由本 hook 接管。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNotificationStore } from '@/stores/notificationState';

import { useFishingMapStore } from '@/features/fishing/stores/fishingMapStore';

import { fishingMapService } from '../api/service';
import type { WeatherAnalysisPayload } from '../types';
import { useAnalysisContext } from '../contexts/AnalysisContext';
import type { StreamFrameType } from '@/lib/llm';

export interface UseFishingAnalysisResult {
  open: boolean;
  payload: WeatherAnalysisPayload | null;
  hasData: boolean;
  toggle: () => void;
  close: () => void;
  generateAnalysis: (modelId: string) => Promise<void>;
}

export function useFishingAnalysis(): UseFishingAnalysisResult {
  const liveWeather = useFishingMapStore((s) => s.liveWeather);
  const forecasts = useFishingMapStore((s) => s.forecasts);
  const tideData = useFishingMapStore((s) => s.tideData);
  const weatherIndices = useFishingMapStore((s) => s.weatherIndices);
  const indexData = useFishingMapStore((s) => s.indexData);
  const locationName = useFishingMapStore((s) => s.locationName);
  const panelTideSpotName = useFishingMapStore((s) => s.panelTideSpotName);

  const notifyError = useNotificationStore((state) => state.error);
  const notifyErrorRef = useRef(notifyError);

  const {
    setAnalysisError,
    setAnalysisResult,
    setAnalysisReasoning,
    setAnalysisLoading,
    analysisAbortRef,
  } = useAnalysisContext();

  const setAnalysisResultRef = useRef(setAnalysisResult);
  const setAnalysisReasoningRef = useRef(setAnalysisReasoning);
  const setAnalysisErrorRef = useRef(setAnalysisError);

  const [open, setOpen] = useState(false);
  const resultBufferRef = useRef('');
  const reasoningBufferRef = useRef('');
  const serviceRef = useRef(fishingMapService());

  useEffect(() => {
    notifyErrorRef.current = notifyError;
  }, [notifyError]);

  useEffect(() => {
    setAnalysisResultRef.current = setAnalysisResult;
    setAnalysisReasoningRef.current = setAnalysisReasoning;
    setAnalysisErrorRef.current = setAnalysisError;
  });

  // 卸载时清理仍在运行的 abort controller
  useEffect(() => {
    return () => {
      analysisAbortRef.current?.abort();
    };
  }, [analysisAbortRef]);

  const payload = useMemo<WeatherAnalysisPayload | null>(() => {
    if (!liveWeather && forecasts.length === 0 && !tideData) {
      return null;
    }
    return {
      liveWeather,
      forecasts,
      tideData,
      weatherIndices,
      fishingIndex: indexData ?? undefined,
      locationName,
      tideSpotName: panelTideSpotName,
    };
  }, [
    liveWeather,
    forecasts,
    tideData,
    weatherIndices,
    indexData,
    locationName,
    panelTideSpotName,
  ]);

  const hasData =
    liveWeather !== null || forecasts.length > 0 || tideData !== null;

  const toggle = useCallback(() => setOpen((prev) => !prev), []);
  const close = useCallback(() => setOpen(false), []);

  const generateAnalysis = useCallback(
    async (modelId: string) => {
      if (!payload) return;

      const controller = new AbortController();
      analysisAbortRef.current = controller;
      resultBufferRef.current = '';
      reasoningBufferRef.current = '';
      setAnalysisResultRef.current('');
      setAnalysisReasoningRef.current('');
      setAnalysisErrorRef.current('');

      try {
        await serviceRef.current.generateAnalysis(
          { ...payload, modelId },
          (content, kind: StreamFrameType = 'content') => {
            // 双通道分流：reasoning → 推理缓冲；content → 正文缓冲（向后兼容旧调用）。
            if (kind === 'reasoning') {
              reasoningBufferRef.current += content;
              setAnalysisReasoningRef.current(reasoningBufferRef.current);
            } else {
              resultBufferRef.current += content;
              setAnalysisResultRef.current(resultBufferRef.current);
            }
          },
          controller.signal,
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError')
          return;
        const message =
          error instanceof Error ? error.message : 'AI 分析失败';
        setAnalysisErrorRef.current(message);
        notifyErrorRef.current(message);
      } finally {
        if (analysisAbortRef.current === controller) {
          analysisAbortRef.current = null;
        }
        setAnalysisLoading(false);
      }
    },
    [payload, analysisAbortRef, setAnalysisLoading],
  );

  return { open, payload, hasData, toggle, close, generateAnalysis };
}