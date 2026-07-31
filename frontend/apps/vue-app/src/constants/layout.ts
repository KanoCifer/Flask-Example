/** 首页 bento 卡片全局缩放系数：卡片内容视觉缩小（DragWrapper 的
 *  `.card-scaler` transform）与偏移间距缩放（useCardLayout）的单一来源。
 *
 *  该值同时被两处消费，修改时必须同步：
 *  - `layouts/components/DragWrapper.vue` 的 `.card-scaler` 通过
 *    `--layout-scale` 自定义属性读取；
 *  - `features/entry/composables/useCardLayout.ts` 用 JS 导入。
 */
export const CARD_LAYOUT_SCALE = 0.85;
