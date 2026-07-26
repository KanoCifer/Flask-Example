// 微信阅读（Weread）领域类型 —— 与 go-backend / Python backend weread 接口对齐

export interface WereadUserInfo {
  user_id: number;
  api_key: string;
}

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

/** 旧名称兼容 —— 实际指向 mode-all 的 OverallRaw */
export type ReadDetailSnapshot = ReadDetailOverallRaw;

/** API 返回：按 mode 返回不同字段集 */
export type WereadReadProgressData =
  | ReadDetailWeeklyRaw
  | ReadDetailMonthlyRaw
  | ReadDetailAnnuallyRaw
  | ReadDetailOverallRaw;

/**
 * 阅读统计 mode 的唯一来源(运行时 + 类型)。
 *
 * 加新 mode 时:push 到这个数组,Record<ReadStatsMode, T> 仍需手动同步 4-mode 形状
 * (这是 issue 06 的工作,4 mode 下不划算)。
 */
export const READ_STATS_MODES = [
  'weekly',
  'monthly',
  'annually',
  'overall',
] as const;

export type ReadStatsMode = (typeof READ_STATS_MODES)[number];

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
  intro: string | null;
  category: string | null;
}

/** read-progress?perDay=true 的 data 形状 */
export interface WereadYearlyHeatmap {
  /** dayUnixSec(字符串) -> 秒;key 形如 "1704067200" */
  readTimes: Record<string, number>;
}
