// 共享 spring / ease 常量 — 全首页动画的物理基础。
// modal / toast 值与 SettingMoal / NotificationContainer 保持一致。

export const SPRING = {
  // 抽屉 / 浮层
  modal: { type: 'spring' as const, stiffness: 320, damping: 32, mass: 0.8 },
  // 快速控件（toast 级）
  toast: { type: 'spring' as const, stiffness: 500, damping: 30 },
  // section 滚动显现
  reveal: { type: 'spring' as const, stiffness: 120, damping: 22, mass: 0.9 },
  // 卡片展开 / 滑动归位
  card: { type: 'spring' as const, stiffness: 280, damping: 26 },
  // 按钮 / pill
  snappy: { type: 'spring' as const, stiffness: 340, damping: 34 },
};

export const EASE = {
  // hero 错峰入场（与 BasicNav 底部弹出层同源）
  outQuint: [0.22, 1, 0.36, 1] as [number, number, number, number],
  // nav indicator 曲线
  nav: [0.32, 0.72, 0, 1] as [number, number, number, number],
};
