// 聚合静态页面对应的 feature views（无 auth 依赖、无循环风险的 feature）。
// 有状态的 feature（auth/blog/books 等）直接在 router/index.ts 中按需导入。
export { EntryView } from '@/features/entry/views';
export { FishingMapView } from '@/features/fishing/views';
export { FriendLinksView } from '@/features/friend-links/views';
export { ChangelogView } from '@/features/changelog/views';
export { WebsitesView } from '@/features/websites/views';
