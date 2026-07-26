import { useStorage } from '@vueuse/core';
import { v4 } from 'uuid';

// 生成 UUID 作为访客唯一标识
function generateVisitorId() {
  return v4();
}

// 使用 VueUse 的 useStorage 来持久化访客 ID
const visitorId = useStorage('visitorId', generateVisitorId());

export function getVisitorId() {
  return visitorId.value;
}
