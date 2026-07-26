// Changelog 领域类型

export interface ChangelogItem {
  type: string;
  content: string;
}

export interface Changelog {
  version: string;
  date: string;
  title: string;
  changes: ChangelogItem[];
}
