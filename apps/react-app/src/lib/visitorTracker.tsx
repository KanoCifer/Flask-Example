import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { UAParser } from 'ua-parser-js';
import { getVisitorId } from './visitorId';
import apiClient from '../api/apiClient';

// 收集前端可获取的追踪信息
const collectVisitorData = () => {
  const { navigator, screen, location } = window;
  const uaParser = new UAParser();
  const uaResult = uaParser.getResult();
  // console.log("UA解析结果:", uaResult); // 调试输出UA解析结果
  return {
    visitor_id: getVisitorId(), // 访客唯一标识
    page_url: location.href, // 当前访问的完整URL
    page_path: location.pathname, // 页面路径
    referrer: document.referrer || '', // 访问来源
    browser: uaResult.ua, // 浏览器/设备信息
    screen_resolution: `${screen.width}x${screen.height}`, // 屏幕分辨率
    language: navigator.language || '', // 浏览器语言
    browser_name: uaResult.browser.name || '', // 浏览器名称
    browser_version: uaResult.browser.version || '', // 浏览器版本
    os_name: uaResult.os.name || '', // 操作系统名称
    os_version: uaResult.os.version || '', // 操作系统版本
    device_type: uaResult.device.type || 'desktop', // 设备类型（mobile/tablet/desktop）
    cpu: uaResult.cpu.architecture || '', // CPU 架构
  };
};

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
