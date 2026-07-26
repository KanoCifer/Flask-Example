import apiClient, { type ApiResponse } from '@/api/apiClient';

export interface WereadUserBook {
  id?: string;
  user_id?: number;
  bookId: string;
  title: string;
  author: string;
  cover: string | null;
  category: string | null;
  isTop: boolean;
  readUpdateTime: number | null;
  updateTime: number | null;
  finishReading: boolean;
  secret: boolean;
  readProgress: WereadBookProgress | null;
  updated_at?: string;
}

export interface WereadArchive {
  id: string;
  user_id: number;
  bookIds: (string | null)[];
  albumIds: (string | null)[];
  name: string;
}

export interface WereadBookDetail {
  id: string;
  bookId: string;
  title: string;
  author: string;
  translator: string | null;
  cover: string | null;
  introduction: string | null;
  category: string | null;
  publisher: string | null;
  publishTime: string | null;
  isbn: string | null;
  wordCount: number | null;
  newRating: number | null;
  newRatingCount: number | null;
  newRatingDetails: Record<string, unknown> | null;
  fetched_at: string;
}

export interface WereadShelfData {
  user_books: WereadUserBook[];
  archives: WereadArchive[];
}

// ── 原始类型（对应 backend weread_detail_raw.py）─────────────────────
// 四种 mode (weekly/monthly/annually/overall) 返回的字段逐级递增：
// - Weekly     → 基础统计 + rank
// - Monthly    → 同上 + preferCategory + readStat
// - Annually   → 同上 + preferAuthor + preferCp + preferPublisher + readRate/wrReadTime
// - Overall    → 同上 + preferTime + preferTimeWord + medals

export interface ReadDetailBook {
  bookId: string | null;
  title: string | null;
  author: string | null;
  translator: string | null;
  intro: string | null;
  cover: string | null;
}

export interface ReadDetailRawLongestItem {
  book: ReadDetailBook | null;
  albumInfo: Record<string, unknown> | null;
  readTime: number;
  tags: string[];
}

export interface ReadDetailRawRank {
  text: string;
  scheme: string;
}

export interface ReadDetailRawStat {
  stat: string;
  counts: string;
}

export interface ReadDetailRawAuthorItem {
  name: string | null;
  count: number | null;
  readTime: string | null;
}

export interface ReadDetailRawCategoryItem {
  categoryTitle: string;
  readingCount: number;
  readingTime: number;
}

export interface ReadDetailRawPublisherItem {
  name: string | null;
  count: number;
}

export interface ReadDetailRawCopyrightInfo {
  name: string;
  userVid: number;
  role: number;
  avatar: string;
  cpType: number;
}

// ── 四种 mode 的层级模型（与 Python raw models 1:1）──

export interface ReadDetailRawBase {
  user_id: number;
  mode: string;
  baseTime: number;
  fetched_at: string;
}

export interface ReadDetailWeeklyRaw extends ReadDetailRawBase {
  readTimes: Record<string, number> | null;
  readDays: number | null;
  readLongest: ReadDetailRawLongestItem[] | null;
  rank: ReadDetailRawRank | null;
  compare: number | null;
  dayAverageReadTime: number | null;
  totalReadTime: number | null;
}

export interface ReadDetailMonthlyRaw extends ReadDetailWeeklyRaw {
  preferCategory: ReadDetailRawCategoryItem[] | null;
  preferCategoryWord: string | null;
  readStat: ReadDetailRawStat[] | null;
}

export interface ReadDetailAnnuallyRaw extends ReadDetailMonthlyRaw {
  preferAuthor: ReadDetailRawAuthorItem[] | null;
  authorCount: number | null;
  preferPublisher: ReadDetailRawPublisherItem[] | null;
  readRate: number | null;
  wrReadTime: number | null;
  wrListenTime: number | null;
}

export interface ReadDetailOverallRaw extends ReadDetailAnnuallyRaw {
  preferTime: number[] | null;
  preferTimeWord: string | null;
}

/** 旧名称兼容 — 实际指向 mode-all 的 OverallRaw (store 用它存所有 mode 的宽类型) */
export type ReadDetailSnapshot = ReadDetailOverallRaw;

/** API 返回：按 mode 返回不同字段集 */
export type WereadReadProgressData =
  | ReadDetailWeeklyRaw
  | ReadDetailMonthlyRaw
  | ReadDetailAnnuallyRaw
  | ReadDetailOverallRaw;

export type ReadStatsMode = 'weekly' | 'monthly' | 'annually' | 'overall';

export interface WereadBookProgress {
  chapterUid: number | null;
  chapterOffset: number | null;
  progress: number | null;
  updateTime: number | null;
  readingTime: number;
  finishTime: number | null;
  isStartReading: string | null;
}

export interface BookRecommendItem {
  bookId: string;
  title: string;
  author: string;
  cover: string | null;
  reason: string;
  readingCount: number;
  searchIdx: number;
  newRating: number; // 0-100
}

/** read-progress?perDay=true 的 data 形状 */
export interface WereadYearlyHeatmap {
  /** dayUnixSec(字符串) -> 秒;key 形如 "1704067200" */
  readTimes: Record<string, number>;
}

export const wereadGateway = {
  async saveUserInfo(apiKey: string): Promise<ApiResponse<null>> {
    const res = await apiClient.post<ApiResponse<null>>('v2/weread/user-info', {
      api_key: apiKey,
    });
    return res.data;
  },

  async getUserShelf(): Promise<ApiResponse<WereadShelfData>> {
    const res = await apiClient.get<ApiResponse<WereadShelfData>>(
      'v2/weread/bookshelf',
    );
    return res.data;
  },

  async getBookInfo(bookId: string): Promise<ApiResponse<WereadBookDetail>> {
    const res = await apiClient.get<ApiResponse<WereadBookDetail>>(
      `v2/weread/book/${bookId}`,
    );
    return res.data;
  },

  async syncMyBooks(): Promise<ApiResponse<{ imported_count: number }>> {
    const res = await apiClient.get<ApiResponse<{ imported_count: number }>>(
      'v2/weread/sync-my-books',
      { timeout: 60000 },
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
      'v2/weread/read-progress',
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
      'v2/weread/read-progress',
      { params },
    );
    return res.data;
  },

  async getBookProgress(
    bookId: string,
    refresh = false,
  ): Promise<ApiResponse<WereadBookProgress | null>> {
    const res = await apiClient.get<ApiResponse<WereadBookProgress | null>>(
      `v2/weread/book/${bookId}/progress`,
      { params: { refresh } },
    );
    return res.data;
  },

  async getBooksRecommend(
    count = 12,
    maxIdx = 0,
  ): Promise<ApiResponse<BookRecommendItem[]>> {
    const res = await apiClient.get<ApiResponse<BookRecommendItem[]>>(
      'v2/weread/books-recommend',
      { params: { count, maxIdx } },
    );
    return res.data;
  },
};
