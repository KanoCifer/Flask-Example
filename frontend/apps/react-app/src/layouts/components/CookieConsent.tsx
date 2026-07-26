import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'cookie_consent_given';

interface CookieCategory {
  id: string;
  label: string;
  description: string;
  required: boolean;
}

const cookieCategories: CookieCategory[] = [
  {
    id: 'essential',
    label: '必要',
    description: '网站运行必需，包括登录状态、安全验证等基础功能',
    required: true,
  },
  {
    id: 'preferences',
    label: '偏好设置',
    description: '记住您的界面偏好，如背景图选择、主题模式等',
    required: false,
  },
];

function CookieIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-warning"
    >
      <path d="M12 2a10 10 0 1 0 10 10h-10Z" />
      <path d="M12 12 2.93 17.33" />
      <path d="M17.33 2.93A10 10 0 0 1 22 12H12Z" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" x2="21" y1="14" y2="3" />
    </svg>
  );
}

export function CookieConsent() {
  const navigate = useNavigate();
  const [consentGiven, setConsentGiven] = useState(
    () => localStorage.getItem(STORAGE_KEY) === 'true',
  );
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPrivacyPreview, setShowPrivacyPreview] = useState(false);
  const [hasReadPrivacy, setHasReadPrivacy] = useState(false);
  const [settings, setSettings] = useState<Record<string, boolean>>({});
  const privacyScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!consentGiven) {
      const timer = setTimeout(() => setShowBanner(true), 800);
      return () => clearTimeout(timer);
    }
  }, [consentGiven]);

  const initSettings = useCallback(() => {
    const initial: Record<string, boolean> = {};
    cookieCategories.forEach((c) => {
      initial[c.id] = c.required;
    });
    setSettings(initial);
  }, []);

  const acceptAll = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setConsentGiven(true);
    setShowBanner(false);
    setShowPrivacyPreview(false);
  }, []);

  const rejectAll = useCallback(() => {
    initSettings();
    localStorage.setItem(STORAGE_KEY, 'true');
    setConsentGiven(true);
    setShowBanner(false);
    setShowPrivacyPreview(false);
  }, [initSettings]);

  const openSettings = useCallback(() => {
    initSettings();
    setShowSettings(true);
  }, [initSettings]);

  const saveSettings = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setConsentGiven(true);
    setShowSettings(false);
    setShowBanner(false);
  }, []);

  const openPrivacy = useCallback(() => {
    setHasReadPrivacy(false);
    setShowPrivacyPreview(true);
  }, []);

  const navigateToFullPolicy = useCallback(() => {
    setShowPrivacyPreview(false);
    setShowBanner(false);
    navigate('/privacy');
  }, [navigate]);

  // TODO(human): Implement privacy policy scroll tracking logic
  // Track if the user has scrolled to the bottom of the privacy policy preview
  // to enable the "Accept" button, ensuring they actually skimmed it.
  const handlePrivacyScroll = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_e: React.UIEvent<HTMLDivElement>) => {
      // Your logic here
    },
    [],
  );

  const toggleSetting = useCallback((id: string) => {
    setSettings((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  return createPortal(
    <>
      {/* Banner */}
      <AnimatePresence>
        {showBanner && !consentGiven && (
          <motion.div
            key="cookie-banner"
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="group bg-page/95 fixed bottom-6 left-1/2 z-9999 w-[340px] -translate-x-1/2 overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-sm transition-all duration-300 sm:bottom-8 sm:w-[380px]"
          >
            <div className="relative px-5 py-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="bg-warning/15 flex h-7 w-7 items-center justify-center rounded-full">
                    <CookieIcon />
                  </span>
                  <span className="text-muted text-[14px] font-semibold tracking-wide">
                    Cookie 与隐私设置
                  </span>
                </div>
                <button
                  onClick={openPrivacy}
                  className="text-warning/80 hover:text-warning flex items-center gap-1 text-[12px] transition-colors"
                >
                  隐私协议预览
                  <ChevronIcon />
                </button>
              </div>
              <p className="text-muted mb-4 text-[13px] leading-relaxed">
                本站使用 Cookie 提升浏览体验。继续使用即表示您同意我们的 Cookie
                政策与隐私协议。
              </p>
              <div className="flex items-center gap-2">
                <button
                  className="text-muted hover:bg-surface hover:text-muted flex-1 rounded-xl border px-3 py-2 text-[12px] font-medium transition-all duration-200 active:scale-[0.97]"
                  onClick={openSettings}
                >
                  自定义
                </button>
                <button
                  className="text-muted hover:bg-surface hover:text-muted flex-1 rounded-xl border px-3 py-2 text-[12px] font-medium transition-all duration-200 active:scale-[0.97]"
                  onClick={rejectAll}
                >
                  拒绝
                </button>
                <button
                  className="bg-warning text-ink hover:bg-warning/90 flex-1 rounded-xl px-3 py-2 text-[12px] font-medium shadow-lg transition-all duration-200 active:scale-[0.97]"
                  onClick={acceptAll}
                >
                  全部接受
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Privacy Preview Dialog */}
      <AnimatePresence>
        {showPrivacyPreview && (
          <DialogOverlay onClose={() => setShowPrivacyPreview(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-page/95 relative w-full max-w-[500px] overflow-hidden rounded-2xl border p-6 shadow-2xl backdrop-blur-sm"
            >
              <h2 className="text-muted relative text-[16px] font-medium">
                隐私协议核心摘要
              </h2>
              <div
                ref={privacyScrollRef}
                className="custom-scrollbar relative flex max-h-[40vh] flex-col gap-3 overflow-y-auto py-2 pr-2"
                onScroll={handlePrivacyScroll}
              >
                <div className="text-muted space-y-4 text-[13px] leading-relaxed">
                  <div>
                    <h4 className="text-muted mb-1 flex items-center gap-1.5 font-medium">
                      <span className="bg-warning h-1.5 w-1.5 rounded-full" />
                      信息收集
                    </h4>
                    <p className="text-muted">
                      我们收集必要的网络身份标识(IP/UA)及浏览过程数据以保障服务运行。
                    </p>
                  </div>
                  <div>
                    <h4 className="text-muted mb-1 flex items-center gap-1.5 font-medium">
                      <span className="bg-warning h-1.5 w-1.5 rounded-full" />
                      本地存储
                    </h4>
                    <p className="text-muted">
                      使用 Cookie 和 LocalStorage
                      保存您的登录状态及界面偏好设置。
                    </p>
                  </div>
                  <div>
                    <h4 className="text-muted mb-1 flex items-center gap-1.5 font-medium">
                      <span className="bg-warning h-1.5 w-1.5 rounded-full" />
                      第三方服务
                    </h4>
                    <p className="text-muted">
                      接入 Gravatar (头像) 及 GitHub OAuth
                      (快捷登录)，仅在您使用时生效。
                    </p>
                  </div>
                  <div className="border-t pt-2">
                    <button
                      onClick={navigateToFullPolicy}
                      className="text-warning/80 hover:text-warning inline-flex items-center gap-1 text-[12px] transition-colors"
                    >
                      阅读完整《隐私政策》
                      <ExternalLinkIcon />
                    </button>
                  </div>
                </div>
              </div>
              <div className="relative mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setShowPrivacyPreview(false)}
                  className="text-muted hover:bg-surface hover:text-muted h-9 rounded-xl border px-4 text-[12px] font-medium transition-all duration-200"
                >
                  返回
                </button>
                <button
                  onClick={acceptAll}
                  disabled={!hasReadPrivacy}
                  className="bg-warning text-ink hover:bg-warning/90 h-9 rounded-xl px-4 text-[12px] font-medium shadow-lg transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  我已阅读并同意
                </button>
              </div>
            </motion.div>
          </DialogOverlay>
        )}
      </AnimatePresence>

      {/* Settings Dialog */}
      <AnimatePresence>
        {showSettings && (
          <DialogOverlay onClose={() => setShowSettings(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-page/95 relative w-full max-w-[400px] overflow-hidden rounded-2xl border p-6 shadow-2xl backdrop-blur-sm"
            >
              <h2 className="text-muted relative text-[15px] font-medium">
                Cookie 偏好设置
              </h2>
              <p className="text-muted relative mt-1 text-[12.5px] leading-relaxed">
                选择允许的 Cookie 类别。您可随时通过清除浏览器数据撤回同意。
              </p>
              <div className="relative flex flex-col gap-2.5 py-1">
                {cookieCategories.map((cat) => (
                  <div
                    key={cat.id}
                    className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors ${cat.required ? 'opacity-70' : ''}`}
                  >
                    <div className="flex h-5 items-center pt-0.5">
                      <input
                        id={`cookie-${cat.id}`}
                        type="checkbox"
                        checked={cat.required || (settings[cat.id] ?? false)}
                        disabled={cat.required}
                        onChange={() => toggleSetting(cat.id)}
                        className="bg-page checked:border-warning checked:bg-warning focus:ring-warning/30 h-3.5 w-3.5 appearance-none rounded-[3px] border transition-all duration-150 focus:ring-1 focus:ring-offset-0 disabled:opacity-60"
                      />
                    </div>
                    <label
                      htmlFor={`cookie-${cat.id}`}
                      className="flex-1 cursor-pointer"
                    >
                      <span className="text-muted text-[13px] font-medium">
                        {cat.label}
                      </span>
                      <p className="text-muted mt-0.5 text-[11.5px]">
                        {cat.description}
                      </p>
                    </label>
                    {cat.required && (
                      <span className="text-muted mt-0.5 shrink-0 rounded-md border px-2 py-0.5 text-[10px]">
                        必需
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className="relative mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-muted hover:bg-surface hover:text-muted h-9 rounded-xl border px-4 text-[12px] font-medium transition-all duration-200"
                >
                  取消
                </button>
                <button
                  onClick={saveSettings}
                  className="bg-warning text-ink hover:bg-warning/90 h-9 rounded-xl px-4 text-[12px] font-medium shadow-lg transition-all duration-200"
                >
                  保存设置
                </button>
              </div>
            </motion.div>
          </DialogOverlay>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
      `}</style>
    </>,
    document.body,
  );
}

function DialogOverlay({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="bg-page/50 fixed inset-0 z-9999 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </motion.div>
  );
}
