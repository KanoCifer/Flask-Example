// 服务状态网关已迁移到 @readinglist/api，此处重新导出以保持兼容

import { statusGateway } from '@readinglist/api';

export { statusGateway };
export type { StatusGateway } from '@readinglist/api';

// 兼容旧函数名 fetchStatusDetail
export const fetchStatusDetail = statusGateway.fetchStatusDetail;
