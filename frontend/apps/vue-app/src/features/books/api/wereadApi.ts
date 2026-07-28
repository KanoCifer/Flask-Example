import { apiClient, type ApiResponse } from '@/api/request';

import type {
  BookRecommendItem,
  WereadBookDetail,
  WereadBookProgress,
  WereadReadProgressData,
  WereadShelfData,
  WereadYearlyHeatmap,
} from '@readinglist/types';
import type { ReadStatsMode } from '@/features/books/types';

export interface WereadGateway {
  saveUserInfo(apiKey: string): Promise<ApiResponse<null>>;
  getUserShelf(): Promise<ApiResponse<WereadShelfData>>;
  getBookInfo(bookId: string): Promise<ApiResponse<WereadBookDetail>>;
  getReadProgress(
    mode: ReadStatsMode,
    baseTime?: number | null,
  ): Promise<ApiResponse<WereadReadProgressData>>;
  /** 年视图日历热力图:拉取指定年份每日的阅读时长(秒) */
  getYearlyHeatmap(year?: number): Promise<ApiResponse<WereadYearlyHeatmap>>;
  getBookProgress(
    bookId: string,
    refresh?: boolean,
  ): Promise<ApiResponse<WereadBookProgress | null>>;
  getBooksRecommend(
    count?: number,
    maxIdx?: number,
  ): Promise<ApiResponse<BookRecommendItem[]>>;
}

export const wereadGateway: WereadGateway = {
  async saveUserInfo(apiKey: string): Promise<ApiResponse<null>> {
    const res = await apiClient.post<ApiResponse<null>>('v3/weread/user-info', {
      api_key: apiKey,
    });
    return res.data;
  },

  async getUserShelf(): Promise<ApiResponse<WereadShelfData>> {
    const res = await apiClient.get<ApiResponse<WereadShelfData>>(
      'v3/weread/shelf',
    );
    return res.data;
  },

  async getBookInfo(bookId: string): Promise<ApiResponse<WereadBookDetail>> {
    const res = await apiClient.get<ApiResponse<WereadBookDetail>>(
      `v3/weread/book/${bookId}`,
    );
    return res.data;
  },

  async getReadProgress(
    mode: ReadStatsMode,
    baseTime?: number | null,
  ): Promise<ApiResponse<WereadReadProgressData>> {
    const params: Record<string, string | number> = { mode };
    if (baseTime != null && mode !== 'overall') params.baseTime = baseTime;
    const res = await apiClient.get<ApiResponse<WereadReadProgressData>>(
      'v3/weread/read-progress',
      { params },
    );
    return res.data;
  },

  async getYearlyHeatmap(
    year?: number,
  ): Promise<ApiResponse<WereadYearlyHeatmap>> {
    const params: Record<string, string | number | boolean> = {
      mode: 'annually',
      perDay: true,
    };
    if (year != null) params.year = year;
    const res = await apiClient.get<ApiResponse<WereadYearlyHeatmap>>(
      'v3/weread/read-progress',
      { params },
    );
    return res.data;
  },

  async getBookProgress(
    bookId: string,
    refresh = false,
  ): Promise<ApiResponse<WereadBookProgress | null>> {
    const res = await apiClient.get<ApiResponse<WereadBookProgress | null>>(
      `v3/weread/book/${bookId}/progress`,
      { params: { refresh } },
    );
    return res.data;
  },

  async getBooksRecommend(
    count = 12,
    maxIdx = 0,
  ): Promise<ApiResponse<BookRecommendItem[]>> {
    const res = await apiClient.get<ApiResponse<BookRecommendItem[]>>(
      'v3/weread/books-recommend',
      { params: { count, maxIdx } },
    );
    return res.data;
  },
};
