import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { collectVisitorData } from '@readinglist/utils';
import apiClient from '../api/apiClient';

// 上报追踪数据到后端
const reportVisitorData = async () => {
  try {
    const data = collectVisitorData();
    // 发送POST请求到FastAPI后端接口
    await apiClient.post('v3/track', data, {
      timeout: 5000, // 超时时间5秒
      // 跨域配置（如果前端和后端域名不同，需后端配合跨域）
      withCredentials: true,
    });
  } catch (error) {
    // 上报失败不影响主流程，仅控制台打印
    if (error instanceof Error) {
      console.warn('访客追踪数据上报失败:', error.message);
    }
  }
};

export function TrackEvent() {
  const location = useLocation();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      reportVisitorData();
    }, 500);
  }, [location]);

  return null;
}
