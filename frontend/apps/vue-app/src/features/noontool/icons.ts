export const icons = {
  pipeline: 'Rocket',
  multiAccount: 'Store',
  translate: 'Languages',
  image: 'Image',
  serial: 'ListOrdered',
  ai: 'Sparkles',
  privacy: 'ShieldCheck',
  faq: 'CircleHelp',
  cta: 'Download',
  support: 'LifeBuoy',
  wechat: 'MessageCircle',
  docs: 'BookOpen',
  github: 'Code',
  footerLink: 'ArrowUpRight',
} as const;

export type IconKey = keyof typeof icons;
