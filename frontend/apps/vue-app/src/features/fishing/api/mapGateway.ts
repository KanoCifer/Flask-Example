import { apiClient } from '@/api/request';

export interface MapGateway {
  getSecurityKey(): Promise<{ securityJsCode: string }>;
}

export const mapGateway: MapGateway = {
  async getSecurityKey(): Promise<{ securityJsCode: string }> {
    const res = await apiClient.get<{ data: { securityJsCode: string } }>(
      'v2/publicv2/amap/security-key',
    );
    return res.data.data;
  },
};
