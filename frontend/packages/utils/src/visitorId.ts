import { v4 } from 'uuid';

// 生成 UUID 作为访客唯一标识
function generateVisitorId() {
  return v4();
}

// 内存 fallback：localStorage 不可用时保持会话内一致
let memoryFallbackId: string | null = null;

const VISITOR_ID_KEY = 'visitor_id';

const setVisitorId = (id: string): void => {
  try {
    localStorage.setItem(VISITOR_ID_KEY, id);
  } catch (e) {
    // localStorage 不可用（Safari 隐私模式 / QuotaExceededError / SSR）— 回退到内存
    memoryFallbackId = id;
  }
};

const getStoredVisitorId = (): string | null => {
  try {
    return localStorage.getItem(VISITOR_ID_KEY);
  } catch (e) {
    return memoryFallbackId;
  }
};

// 初始化访客ID — 永不抛异常
export function getVisitorId(): string {
  // 1. 优先从 localStorage 读取
  let visitorId = getStoredVisitorId();
  if (visitorId) return visitorId;

  // 2. 生成新 ID 并尝试持久化（失败则存内存）
  visitorId = generateVisitorId();
  setVisitorId(visitorId);
  return visitorId;
}
