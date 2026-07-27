/**
 * React-app 全局测试 setup — 在每个测试文件之前运行。
 * 公共部分由 @readinglist/config/vitest-setup 提供。
 */

import '@testing-library/jest-dom/vitest';
import '@readinglist/config/vitest-setup';

export { flushRAF } from '@readinglist/config/vitest-setup';
