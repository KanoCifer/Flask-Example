import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';

import { useShallow } from 'zustand/react/shallow';

import { useFishingMapStore } from '@/features/fishing/stores/fishingMapStore';

interface AnalysisContextValue {
  analysisOpen: boolean;
  analysisLoading: boolean;
  analysisError: string;
  analysisResult: string;
  /** 推理通道累积（与正文分开），用于渲染可折叠「思考过程」区。 */
  analysisReasoning: string;
  analysisHasData: boolean;
  setAnalysisOpen: (open: boolean) => void;
  setAnalysisLoading: (loading: boolean) => void;
  setAnalysisError: (error: string) => void;
  setAnalysisResult: (result: string) => void;
  setAnalysisReasoning: (reasoning: string) => void;
  toggleAnalysis: () => void;
  closeAnalysis: () => void;
  abortAnalysis: () => void;
  analysisAbortRef: RefObject<AbortController | null>;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

interface AnalysisProviderProps {
  children: ReactNode;
}

/**
 * Provider 自己从 store 拉 hasData — 调用方无需把 hasData 传进来,
 * 这样 useFishingAnalysis 可以在 provider 内部自由调用 useAnalysisContext。
 */
export function AnalysisContextProvider({ children }: AnalysisProviderProps) {
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [analysisResult, setAnalysisResult] = useState('');
  const [analysisReasoning, setAnalysisReasoning] = useState('');
  const analysisAbortRef = useRef<AbortController | null>(null);

  const { liveWeather, forecasts, tideData } = useFishingMapStore(
    useShallow((s) => ({
      liveWeather: s.liveWeather,
      forecasts: s.forecasts,
      tideData: s.tideData,
    })),
  );

  const analysisHasData = useMemo(
    () => liveWeather !== null || forecasts.length > 0 || tideData !== null,
    [liveWeather, forecasts, tideData],
  );

  const toggleAnalysis = useCallback(() => {
    setAnalysisOpen((prev) => !prev);
  }, []);

  const closeAnalysis = useCallback(() => {
    setAnalysisOpen(false);
  }, []);

  const abortAnalysis = useCallback(() => {
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
    setAnalysisLoading(false);
  }, []);

  const value = useMemo<AnalysisContextValue>(
    () => ({
      analysisOpen,
      analysisLoading,
      analysisError,
      analysisResult,
      analysisReasoning,
      analysisHasData,
      setAnalysisOpen,
      setAnalysisLoading,
      setAnalysisError,
      setAnalysisResult,
      setAnalysisReasoning,
      toggleAnalysis,
      closeAnalysis,
      abortAnalysis,
      analysisAbortRef,
    }),
    [
      analysisOpen,
      analysisLoading,
      analysisError,
      analysisResult,
      analysisReasoning,
      analysisHasData,
      setAnalysisOpen,
      setAnalysisLoading,
      setAnalysisError,
      setAnalysisResult,
      setAnalysisReasoning,
      toggleAnalysis,
      closeAnalysis,
      abortAnalysis,
    ],
  );

  return (
    <AnalysisContext.Provider value={value}>
      {children}
    </AnalysisContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAnalysisContext(): AnalysisContextValue {
  const ctx = useContext(AnalysisContext);
  if (!ctx) {
    throw new Error(
      'useAnalysisContext must be used inside AnalysisContextProvider',
    );
  }
  return ctx;
}
