/** 判断字符串是否仅由 Emoji（Extended_Pictographic）构成 */
export const isPureEmoji = (s: string): boolean =>
  /\p{Extended_Pictographic}/u.test(s);
