import { analyticsGateway } from '@/features/analytics';
import { UAParser } from 'ua-parser-js';
import { getVisitorId } from './visitor-id';

// 收集前端可获取的追踪信息
export function collectVisitorData() {
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
}

// 上报追踪数据到后端
export async function reportVisitorData() {
  try {
    const data = collectVisitorData();
    // 发送POST请求到FastAPI后端接口
    await analyticsGateway.reportVisitorData(data);
  } catch (error) {
    // 上报失败不影响主流程，仅控制台打印
    if (error instanceof Error) {
      console.warn('访客追踪数据上报失败:', error.message);
    }
  }
}
