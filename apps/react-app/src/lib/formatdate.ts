import dayjs from 'dayjs';
// import 'dayjs/locale/zh-cn';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);

export const formatDate = (
  dateStr: string | null | undefined,
  format: string = 'YYYY-MM-DD HH:mm:ss',
): string => {
  if (!dateStr) return '未知时间';
  return dayjs(dateStr).format(format);
};
