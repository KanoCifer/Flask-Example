import { useAuthStore } from '@/features/auth';
import { useVisitorCountStore } from '@/features/visitor';
import { motion } from 'framer-motion';
import { BasicFooter } from './BasicFooter';
import { SettingModal } from './SettingMoal';
import {
  BookOpen,
  ChevronDown,
  Cog,
  ExternalLink,
  History,
  Home,
  Image as ImageIcon,
  Info,
  Link2,
  LogIn,
  LogOut,
  TextAlignJustify,
  User,
  UserPlus,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useClickOutside } from '@/hooks/useClickOutside';

const navItems = [
  { path: '/', label: '首页', icon: Home },
  { path: '/blog', label: '近期文章', icon: BookOpen },
  { path: '/bookshelf', label: '我的书架', icon: BookOpen },
  { path: '/gallery', label: '照片墙', icon: ImageIcon },
  { path: '/version-log', label: '更新日志', icon: History },
  { path: '/friend-links', label: '友情链接', icon: Link2 },
  { path: '/about', label: '关于网站', icon: Info },
];

function DropDownItems() {
  const auth = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginout = () => {
    try {
      setIsLoading(true);
      if (auth.isAuthenticated) {
        auth.logout();
      }
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (auth.isAuthenticated) {
    return (
      <>
        <Link
          to="/settings"
          className="hover:bg-surface flex items-center gap-2 rounded-xl p-2 select-none"
        >
          <User className="h-4 w-4" /> Profile
        </Link>
        <div className="bg-border my-1 h-px"></div>
        <button
          onClick={handleLoginout}
          disabled={isLoading}
          className="text-error hover:bg-error/10 flex items-center gap-2 rounded-xl p-2 font-bold"
        >
          <LogOut className="h-4 w-4" />
          {isLoading ? 'Signing out...' : 'Logout'}
        </button>
      </>
    );
  } else {
    return (
      <>
        <Link
          to="/login"
          className="hover:bg-surface flex items-center gap-2 rounded-xl p-2 select-none"
        >
          <LogIn className="h-4 w-4" /> Login
        </Link>
        <Link
          to="/register"
          className="hover:bg-surface flex items-center gap-2 rounded-xl p-2 select-none"
        >
          <UserPlus className="h-4 w-4" /> Register
        </Link>
      </>
    );
  }
}

function DelayStatus({ ms, onClick }: { ms: number; onClick?: () => void }) {
  if (!ms) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="text-muted inline-flex items-center gap-1.5 text-xs"
      >
        <span className="relative flex h-2 w-2">
          <span className="bg-surface absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
          <span className="bg-surface relative inline-flex h-2 w-2 rounded-full" />
        </span>
        延迟 -- ms
        <ExternalLink className="h-3 w-3 opacity-60" />
      </button>
    );
  }
  const label = `${Math.round(ms)} ms`;
  const dotClass =
    ms < 200 ? 'bg-success' : ms < 2000 ? 'bg-warning' : 'bg-destructive';
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-muted inline-flex items-center gap-1.5 text-xs"
    >
      <span className="relative flex h-2 w-2">
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dotClass}`}
        />
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${dotClass}`}
        />
      </span>
      延迟 {label}
    </button>
  );
}

export const BentoNavSidebar: React.FC = () => {
  const auth = useAuthStore();
  const visitorCount = useVisitorCountStore((s) => s.count);
  const connectionDelay = useVisitorCountStore((s) => s.connectionDelay);
  const location = useLocation();
  const activeIndex = navItems.findIndex(
    (item) => location.pathname === item.path,
  );
  const [hoverNavIndex, setHoverNavIndex] = useState(
    activeIndex !== -1 ? activeIndex : 0,
  );
  const [isOpen, setIsOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSettingOpen, setIsSettingOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentUserName = auth.isAuthenticated
    ? auth.user?.name || '用户'
    : '游客';
  const avatarUrl =
    auth.isAuthenticated && auth.user?.photo
      ? auth.user.photo.startsWith('http')
        ? auth.user.photo
        : `/v3/media/${auth.user.photo}`
      : '/images/about.webp';

  useEffect(() => {
    const index = navItems.findIndex((item) => location.pathname === item.path);
    if (index !== -1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHoverNavIndex(index);
    }
  }, [location.pathname]);

  // 点击 dropdown 外部时关闭
  useClickOutside(dropdownRef, () => setIsDropdownOpen(false));

  // 侧边栏打开时禁止背景滚动
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
    } else {
      const scrollY = document.body.style.top;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
      window.scrollTo(0, parseInt(scrollY || '0') * -1);
    }
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* 侧边栏开关键 */}
      <div className="pointer-events-none fixed top-0 left-0 z-50 w-full p-4">
        <button
          onClick={() => setIsOpen(true)}
          className="bg-secondary/50 pointer-events-auto rounded-full p-2 shadow-lg backdrop-blur-sm transition-transform active:scale-95"
        >
          <TextAlignJustify className="text-ink h-6 w-6" />
        </button>
      </div>

      {/* 背景层 */}
      {isOpen && (
        <motion.div
          className="bg-page/50 fixed inset-0 z-90 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />
      )}

      {/* 侧边栏 */}
      <motion.aside
        initial={{ x: '-100%' }}
        animate={{ x: isOpen ? 0 : '-100%' }}
        transition={{
          duration: 0.3,
          ease: 'easeInOut',
        }}
        className="bg-page/90 fixed top-0 left-0 z-100 flex h-screen w-80 flex-col gap-6 rounded-r-4xl p-6 backdrop-blur-sm"
      >
        {/* 下拉菜单 */}
        <div ref={dropdownRef} className="relative">
          <div className="flex items-center justify-between gap-4 px-2 transition-transform hover:cursor-pointer active:scale-95">
            <div
              className="flex items-center justify-center gap-3"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <img
                src={avatarUrl}
                alt={currentUserName}
                className="h-14 w-14 rounded-full object-cover shadow-[0_0_14px_rgba(0,0,0,0.8)] ring-4 ring-(--secondary)"
              />
              <div className="ml-4 flex items-baseline gap-2">
                <span className="text-base-content truncate font-serif text-2xl font-bold text-nowrap select-none">
                  {currentUserName}
                </span>
                <ChevronDown className="text-base-content/70 h-4 w-4" />
              </div>
            </div>
            <button
              onClick={() => {
                setIsDropdownOpen(false);
                setIsSettingOpen(true);
              }}
              className="text-base-content/70 hover:text-base-content transition-colors"
            >
              <Cog className="size-6" />
            </button>
          </div>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="selection-none bg-page absolute top-full left-0 z-50 mt-4 flex w-60 flex-col gap-1 rounded-2xl p-2 shadow-xl"
            >
              <DropDownItems />
            </motion.div>
          )}
        </div>

        <div className="text-base-content/50 mt-4 border-b px-3 pb-2 text-sm font-bold tracking-wider">
          GENERAL
        </div>

        {/* Navigation List */}
        <ul className="relative flex grow flex-col gap-1">
          {/* Active indicator */}
          <motion.div
            className="bg-accent/30 pointer-events-none absolute left-0 h-12 w-full rounded-2xl shadow-md"
            animate={{ y: hoverNavIndex * 52 }} // 52 = item height (48) + gap (4)
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{ zIndex: 0 }}
          />

          {navItems.map((item, index) => (
            <li
              key={item.path}
              onMouseEnter={() => setHoverNavIndex(index)}
              className="z-10 flex h-12"
            >
              <Link
                to={item.path}
                onClick={() => {
                  setIsDropdownOpen(false);
                  setIsOpen(false);
                }}
                className={`flex h-full w-full items-center gap-4 rounded-2xl px-4 font-medium transition-colors ${
                  hoverNavIndex === index
                    ? 'text-ink'
                    : 'text-base-content/70 hover:text-base-content'
                }`}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="text-[15px]">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>

        {/* 状态栏：在线人数 + 延迟 */}
        <div className="text-muted flex items-center justify-between px-3 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="bg-success absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
              <span className="bg-success relative inline-flex h-2 w-2 rounded-full" />
            </span>
            {visitorCount} 人在线
          </span>
          <DelayStatus ms={connectionDelay} />
        </div>

        <div className="mb-30 border-t pt-1 text-center text-sm">
          <BasicFooter />
        </div>
      </motion.aside>

      <SettingModal
        isOpen={isSettingOpen}
        onClose={() => setIsSettingOpen(false)}
      />
    </>
  );
};
