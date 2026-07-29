/** 从 { data: { data: T } } 中解出 T */
export const extractData = <T = unknown>(res: { data: { data: T } }): T =>
  res.data.data;
