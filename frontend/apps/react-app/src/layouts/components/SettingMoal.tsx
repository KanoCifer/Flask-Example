import { Moon, Monitor, Sun, X } from 'lucide-react';
import {
  useThemeState,
  type ColorScheme,
  type Theme,
} from '@/stores/themeState';
import { useShallow } from 'zustand/shallow';
import { playThemeTransition } from '@/lib/themeTransition';
import { BottomSheet } from '@/components';
import { useEffect } from 'react';

/* ───────────────────────── static data ───────────────────────── */

const COLOR_SCHEMES: {
  value: ColorScheme;
  label: string;
  colors: string[];
  desc: string;
}[] = [
  {
    value: 'paper',
    label: 'Paper · 纸',
    colors: ['#a87649', '#7a8e6b', '#5a6b7a'],
    desc: '落纸烟云 · 3 色',
  },
  {
    value: 'sage',
    label: 'Sage',
    colors: ['#6e8d6e', '#a89968', '#7d8a9b'],
    desc: '清隽素雅 · 3 色',
  },
  {
    value: 'mist',
    label: 'Mist',
    colors: ['#6c8aa4', '#7d9d8a', '#b09878'],
    desc: '烟岚氤氲 · 3 色',
  },
  {
    value: 'blush',
    label: 'Blush',
    colors: ['#a87180', '##7d9080', '#8a7474'],
    desc: '桃夭未央 · 3 色',
  },
];

const THEMES: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: 'system', label: '系统', Icon: Monitor },
  { value: 'light', label: '浅色', Icon: Sun },
  { value: 'dark', label: '深色', Icon: Moon },
];

/* ───────────────────────── component ───────────────────────── */

export function SettingModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { theme, font, scheme, setTheme, setFont, setScheme } = useThemeState(
    useShallow((s) => ({
      theme: s.theme,
      font: s.font,
      scheme: s.scheme,
      setTheme: s.setTheme,
      setFont: s.setFont,
      setScheme: s.setScheme,
    })),
  );

  // 锁滚动
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  return (
    <BottomSheet
      open={isOpen}
      onClose={onClose}
      maxH="88vh"
      lockScroll
      renderHeader={() => (
        <header className="shrink-0 px-5 pt-3 pb-4">
          <div className="bg-surface mx-auto mb-4 h-1.5 w-10 rounded-full" />
          <div className="flex items-center justify-between">
            <h1 className="text-ink font-serif text-lg font-semibold">
              偏好设置
            </h1>
            <button
              onClick={onClose}
              className="text-muted hover:bg-surface hover:text-ink flex h-9 w-9 items-center justify-center rounded-full transition-colors active:scale-[0.96]"
              aria-label="关闭"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>
      )}
    >
      <div className="px-5 pb-8">
        <div className="space-y-8">
          {/* 主题模式 */}
          <section>
            <h2 className="text-ink mb-3 font-serif text-base font-semibold">
              主题模式
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {THEMES.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  onClick={(e) => {
                    setTheme(value);
                    playThemeTransition(e as unknown as MouseEvent, value);
                  }}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors ${
                    theme === value
                      ? 'border-accent bg-accent/5 shadow-sm'
                      : 'hover:border-accent bg-page'
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${theme === value ? 'text-ink' : 'text-ink'}`}
                  />
                  <span
                    className={`text-xs ${theme === value ? 'text-ink font-semibold' : 'text-ink'}`}
                  >
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* 字体 */}
          <section>
            <h2 className="text-ink mb-3 font-serif text-base font-semibold">
              字体
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  value: 'default' as const,
                  label: '默认字体',
                  sub: 'PingFang SC',
                },
                {
                  value: 'harmonyos' as const,
                  label: 'HarmonyOS Sans',
                  sub: '鸿蒙字体',
                },
              ].map((o) => (
                <button
                  key={o.value}
                  onClick={() => setFont(o.value)}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-3 transition-colors ${
                    font === o.value
                      ? 'border-accent bg-accent/5 !shadow-sm'
                      : 'bg-page hover:border-accent'
                  }`}
                >
                  <span
                    className={`text-sm font-semibold ${font === o.value ? 'text-ink' : 'text-ink'}`}
                    style={
                      o.value === 'harmonyos'
                        ? {
                            fontFamily: 'Noto Sans SC, sans-serif',
                            fontWeight: 500,
                          }
                        : undefined
                    }
                  >
                    {o.label}
                  </span>
                  <span className="text-muted font-mono text-[10px]">
                    {o.sub}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* 配色方案 */}
          <section>
            <h2 className="text-ink mb-3 font-serif text-base font-semibold">
              配色方案
            </h2>
            <div className="space-y-2">
              {COLOR_SCHEMES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setScheme(s.value)}
                  className={`flex w-full items-stretch overflow-hidden rounded-xl border transition-colors ${
                    scheme === s.value
                      ? 'border-accent bg-accent/5 !shadow-sm'
                      : 'bg-page hover:border-accent'
                  }`}
                >
                  <div className="flex w-[72px] flex-col">
                    {s.colors.map((c, i) => (
                      <div
                        key={i}
                        className="flex-1"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="flex-1 px-4 py-3 text-left">
                    <div className="text-ink text-sm font-semibold">
                      {s.label}
                    </div>
                    <div className="text-muted mt-0.5 text-[11px] italic">
                      {s.desc}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* 品牌签名 */}
        <footer className="mt-10 flex items-center justify-between font-mono text-[11px]">
          <span className="text-muted font-sans">Settings · v4.7.0</span>
          <span className="text-muted font-serif italic">ka·no·ci·fer</span>
        </footer>
      </div>
    </BottomSheet>
  );
}
