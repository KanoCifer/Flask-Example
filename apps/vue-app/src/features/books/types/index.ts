// 阅读统计 mode 的唯一来源(运行时 + 类型)。
//
// 加新 mode 时:push 到这个数组,Record<ReadStatsMode, T> 仍需手动同步 4-mode 形状
// (这是 issue 06 的工作,4 mode 下不划算)。
export const READ_STATS_MODES = [
  'weekly',
  'monthly',
  'annually',
  'overall',
] as const;

export type ReadStatsMode = (typeof READ_STATS_MODES)[number];
