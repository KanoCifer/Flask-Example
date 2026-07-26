import apiClient from '@/api/apiClient';

export interface SocialGateway {
  getLikes(): Promise<{ likes_count: number }>;
  likeOnce(payload: { likes_count: number }): Promise<void>;
}

export const socialGateway: SocialGateway = {
  async getLikes(): Promise<{ likes_count: number }> {
    const res = await apiClient.get<{ data: { likes_count: number } }>(
      'v1/likes',
    );
    // console.log(res);
    return res.data.data;
  },

  async likeOnce(payload: { likes_count: number }): Promise<void> {
    await apiClient.post('v1/like', payload);
  },
};
