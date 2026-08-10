export const icons = {
  pipeline: 'Rocket',
  cart: 'ShoppingCart',
  translate: 'Languages',
  competitor: 'Eye',
  serial: 'ListOrdered',
  ai: 'Sparkles',
  privacy: 'ShieldCheck',
  faq: 'CircleHelp',
  cta: 'Download',
  footerLink: 'ArrowUpRight',
} as const;

export type IconKey = keyof typeof icons;
