import { analyticsGateway } from '@/features/analytics';
import { collectVisitorData } from '@readinglist/utils';

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
