import { UAParser } from 'ua-parser-js';
import { getVisitorId } from './visitorId';

export interface VisitorData {
  visitor_id: string;
  page_url: string;
  page_path: string;
  referrer: string;
  browser: string;
  screen_resolution: string;
  language: string;
  browser_name: string;
  browser_version: string;
  os_name: string;
  os_version: string;
  device_type: string;
  cpu: string;
}

// UA 解析结果在会话内不变，惰性缓存避免每次调用重复解析
let cachedUaResult: UAParser.IResult | null = null;
function getUaResult(): UAParser.IResult {
  if (!cachedUaResult) {
    cachedUaResult = new UAParser().getResult();
  }
  return cachedUaResult;
}

// 收集前端可获取的追踪信息（纯函数，不含上报逻辑）
export const collectVisitorData = (): VisitorData => {
  const { navigator, screen, location } = window;
  const uaResult = getUaResult();
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
