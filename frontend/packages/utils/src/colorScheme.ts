export type ColorScheme = 'paper' | 'sage' | 'mist' | 'blush';

export const COLOR_SCHEMES: readonly ColorScheme[] = [
  'paper',
  'sage',
  'mist',
  'blush',
];

export const isColorScheme = (v: unknown): v is ColorScheme =>
  typeof v === 'string' && (COLOR_SCHEMES as readonly string[]).includes(v);

export const safeScheme = (v: unknown): ColorScheme =>
  isColorScheme(v) ? v : 'paper';
