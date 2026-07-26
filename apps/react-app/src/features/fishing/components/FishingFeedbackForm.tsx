/**
 * 钓鱼反馈 sheet —— 复用 BottomSheet。
 *
 * 移动端: 全宽 bottom sheet (BottomSheet 默认)
 * 桌面端 (≥sm): 居中 modal (max-w-md, 居中浮起)
 */
import { useCallback, useMemo, useState } from 'react';

import { useNotificationStore } from '@/stores/notificationState';

import { useFishingMapStore } from '@/features/fishing/stores/fishingMapStore';
import { BottomSheet } from '@/components';
import dayjs from 'dayjs';
import { X } from 'lucide-react';
import { fishingMapService } from '../api/service';
import type { FishingFeedbackData, FishingLevel } from '../types';

interface FishingFeedbackFormProps {
  open: boolean;
  fishingData: FishingFeedbackData;
  locationId: string;
  locationName: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const FEEDBACK_OPTIONS: { value: FishingLevel; label: string }[] = [
  { value: '爆护', label: '爆护' },
  { value: '好', label: '好' },
  { value: '一般', label: '一般' },
  { value: '差', label: '差' },
  { value: '空军', label: '空军' },
];

export function FishingFeedbackForm({
  open,
  fishingData,
  locationId,
  locationName,
  onSuccess,
  onCancel,
}: FishingFeedbackFormProps) {
  const notifyError = useNotificationStore((state) => state.error);
  const notifySuccess = useNotificationStore((state) => state.success);
  const liveWeather = useFishingMapStore((s) => s.liveWeather);
  const service = useMemo(() => fishingMapService(), []);

  const [loading, setLoading] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<FishingLevel | null>(
    null,
  );

  const feedbackPayload = useMemo(() => {
    return {
      location_id: locationId,
      location_name: locationName,
      fishing_time: dayjs().toISOString(),
      feedback: selectedFeedback!,
      temperature: Number(liveWeather?.temp) || fishingData.temperature,
      humidity: Number(liveWeather?.humidity) || fishingData.humidity,
      pressure: Number(liveWeather?.pressure) || fishingData.pressure,
      wind_speed: Number(liveWeather?.windSpeed) || fishingData.wind_speed,
      precipitation: Number(liveWeather?.precip) || fishingData.precipitation,
      indices: fishingData.indices,
      tide_level: fishingData.tide_level,
      tide_type: fishingData.tide_type,
      tide_range: fishingData.tide_range,
      hours_to_next_tide: fishingData.hours_to_next_tide,
    };
  }, [fishingData, liveWeather, locationId, locationName, selectedFeedback]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!selectedFeedback) {
        notifyError('请选择钓鱼体验');
        return;
      }

      setLoading(true);

      try {
        await service.submitFishingFeedback(feedbackPayload);
        notifySuccess('反馈已提交，感谢您的分享！');
        onSuccess?.();
      } catch (err) {
        const message =
          err instanceof Error ? err.message : '提交反馈失败，请重试';
        notifyError(message);
      } finally {
        setLoading(false);
      }
    },
    [
      feedbackPayload,
      notifyError,
      notifySuccess,
      onSuccess,
      service,
      selectedFeedback,
    ],
  );

  // 桌面端居中样式覆盖 (与移动端 bottom sheet 共用 BottomSheet, 通过 style 注入)
  const desktopCenteringStyle = `
    @media (min-width: 640px) {
      [role="dialog"][aria-label="钓鱼反馈"] {
        left: 50% !important;
        right: auto !important;
        bottom: auto !important;
        top: 50% !important;
        transform: translate(-50%, -50%) !important;
        width: min(420px, 90vw);
        max-height: 90vh;
        border-radius: 24px !important;
        border: 1px solid color-mix(in oklch, var(--ink) 12%, transparent);
      }
    }
  `;

  return (
    <BottomSheet
      open={open}
      onClose={() => onCancel?.()}
      maxH="85vh"
      lockScroll
      renderHeader={() => (
        <header className="shrink-0 px-5 pt-3 pb-3">
          <style>{desktopCenteringStyle}</style>
          <div className="flex items-center justify-between">
            <h2 className="text-ink text-base font-semibold">钓鱼反馈</h2>
            <button
              type="button"
              aria-label="关闭"
              onClick={() => onCancel?.()}
              className="hover:bg-surface text-muted inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>
      )}
    >
      <div className="flex flex-col gap-4 px-5 pb-6">
        <p className="text-muted -mt-1 text-xs">你的反馈会帮助我们改进</p>

        {/* Context — Apple HIG inset tile */}
        <div className="fm-tile px-3 py-2.5">
          <p className="text-muted text-xs">地点 · {locationName}</p>
          <p className="text-ink mt-0.5 text-sm tabular-nums">
            当前指数 {fishingData.fishing_index}{' '}
            <span className="text-muted">({fishingData.level})</span>
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className="text-ink mb-2 block text-sm font-medium">
              您的钓鱼体验
            </label>
            <div className="fm-segmented w-full overflow-hidden">
              {FEEDBACK_OPTIONS.map((option) => {
                const isActive = selectedFeedback === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSelectedFeedback(option.value)}
                    aria-pressed={isActive}
                    className={`min-h-9 flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-all duration-200 ease-out ${
                      isActive
                        ? 'bg-page text-ink shadow-sm'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => onCancel?.()}
              className="bg-surface text-ink hover:bg-surface/70 min-h-11 flex-1 rounded-full px-4 text-sm font-medium transition-colors"
              disabled={loading}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!selectedFeedback || loading}
              className="bg-accent text-ink hover:bg-accent/90 min-h-11 flex-1 rounded-full px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? '提交中...' : '确认提交'}
            </button>
          </div>
        </form>
      </div>
    </BottomSheet>
  );
}
