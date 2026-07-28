import {
  wereadGateway,
  type ReadStatsMode,
} from '@/features/books/api/wereadGateway';

export const wereadService = {
  async saveUserInfo(apiKey: string) {
    return wereadGateway.saveUserInfo(apiKey);
  },

  async getUserShelf() {
    return wereadGateway.getUserShelf();
  },

  async getBookInfo(bookId: string) {
    return wereadGateway.getBookInfo(bookId);
  },

  async getReadProgress(mode: ReadStatsMode, baseTime?: number | null) {
    return wereadGateway.getReadProgress(mode, baseTime);
  },

  async getYearlyHeatmap(year?: number) {
    return wereadGateway.getYearlyHeatmap(year);
  },

  async getBookProgress(bookId: string, refresh = false) {
    return wereadGateway.getBookProgress(bookId, refresh);
  },

  async getBooksRecommend(count = 12, maxIdx = 0) {
    return wereadGateway.getBooksRecommend(count, maxIdx);
  },
};
