export { momentsGateway } from './momentsGateway';
export type { MomentsGateway } from './momentsGateway';

// 列表查询参数 —— 真源在 @/features/moments/types，桶重新导出以保持兼容
export type {
  ListAdminMomentsParams,
  ListPublicMomentsParams,
} from '@/features/moments/types';
