import { v4 } from 'uuid';

// 生成 UUID 作为访客唯一标识
function generateVisitorId() {
  return v4();
}

const setVisitorId = (id: string) => {
  localStorage.setItem('visitor_id', id);
};

const getStoredVisitorId = (): string | null => {
  return localStorage.getItem('visitor_id');
};

// 初始化访客ID
export function getVisitorId() {
  let visitorId = getStoredVisitorId();
  if (!visitorId) {
    visitorId = generateVisitorId();
    setVisitorId(visitorId);
  }
  return visitorId;
}
