// Color feature — public barrel.
// 视图本身不在此处 re-export（router 直接从 ./views 导入，避免循环）。
export { SCHEME_META, TOKEN_META, TOKEN_GROUPS } from './lib/schemeMeta';
export { useSchemeTokens, listSchemes } from './composables/useSchemeTokens';
export type { ColorScheme, SchemeMeta, TokenMeta } from './types';
