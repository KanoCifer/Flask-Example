import { AnimatePresence, motion } from 'motion/react';
import { Fragment, useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  FileText,
  Grid2x2,
  Home,
  Info,
  LogIn,
  LogOut,
  MessageCircle,
  Monitor,
  MoreHorizontal,
  Newspaper,
  Rss,
  Settings,
  UserPlus,
} from 'lucide-react';
import { useAuthStore } from '@/features/auth';
import { BottomSheet } from '@/components';
import { switchToVue } from '@/lib/deviceSwitch';
import { useNavVisibility } from './NavVisibilityContext';

interface MenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

interface NavItemProps {
  icon: React.ReactNode;
  to: string;
}

const ICON_SIZE = 'size-[22px]';
const NAV_ITEM_WIDTH = 64; // px, matches NavItem link w-16

const MENU_ITEMS = [
  {
    path: '/bookshelf',
    label: 'Bookshelf',
    icon: <BookOpen className="h-6 w-6" />,
  },
  {
    path: '/moments',
    label: 'Moments',
    icon: <FileText className="h-6 w-6" />,
  },
  {
    path: '/messages',
    label: 'Messages',
    icon: <MessageCircle className="h-6 w-6" />,
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: <Settings className="h-6 w-6" />,
  },
  { path: '/about', label: 'About', icon: <Info className="h-6 w-6" /> },
] as const;

function NavItem({ icon, to }: NavItemProps) {
  return (
    <div className="flex items-center justify-center">
      <Link
        to={to}
        className="text-muted hover:text-ink flex h-14 w-16 items-center justify-center rounded-full transition duration-300 hover:scale-110 active:scale-[0.96]"
      >
        {icon}
      </Link>
    </div>
  );
}

function MenuItem({ icon, label, onClick }: MenuItemProps) {
  return (
    <motion.button
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.2 } },
        exit: { opacity: 0, transition: { duration: 0.15 } },
      }}
      className="/20 bg-page/40 flex items-center gap-3 rounded-xl border p-4 transition-transform active:scale-[0.96]"
      onClick={(e) => onClick(e)}
    >
      <span className="text-ink shrink-0">{icon}</span>
      <span className="text-ink text-sm font-bold">{label}</span>
    </motion.button>
  );
}

export function BasicNav() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { hidden } = useNavVisibility();

  const handleLogout = () => {
    logout();
    navigate('/');
  };
  const [showMenu, setShowMenu] = useState(false);
  const onClose = useCallback(() => setShowMenu(false), []);

  const handleNav = (path: string) => {
    setShowMenu(false);
    navigate(path);
  };

  const location = useLocation();

  // 当前激活的导航索引（0-2 为主线，3 为「更多」）
  const activeIndex = useMemo(() => {
    if (showMenu) return 3;
    if (location.pathname === '/') return 0;
    if (location.pathname === '/blog') return 1;
    if (location.pathname === '/rss') return 2;
    return 3;
  }, [location.pathname, showMenu]);

  return (
    <Fragment>
      {/* More Menu — 底部抽屉 */}
      <BottomSheet
        open={showMenu}
        onClose={onClose}
        renderHeader={() => (
          <div className="shrink-0 px-5 pt-3 pb-2">
            <div className="bg-surface mx-auto h-1.5 w-10 rounded-full" />
          </div>
        )}
      >
        <div className="px-5 pb-8">
          <div className="grid grid-cols-1 gap-2">
            {MENU_ITEMS.map((item) => (
              <MenuItem
                key={item.path}
                icon={item.icon}
                label={item.label}
                onClick={() => handleNav(item.path)}
              />
            ))}
            {/* Auth section */}
            {!isAuthenticated ? (
              <>
                <MenuItem
                  icon={<LogIn className="h-6 w-6" />}
                  label="Login"
                  onClick={() => handleNav('/login')}
                />
                <MenuItem
                  icon={<UserPlus className="h-6 w-6" />}
                  label="Register"
                  onClick={() => handleNav('/register')}
                />
              </>
            ) : (
              <MenuItem
                icon={<LogOut className="h-6 w-6" />}
                label="Logout"
                onClick={handleLogout}
              />
            )}
            <MenuItem
              icon={<Monitor className="h-6 w-6" />}
              label="Desktop"
              onClick={switchToVue}
            />
          </div>
        </div>
      </BottomSheet>

      {/* Bottom Navigation Bar */}
      {createPortal(
        <AnimatePresence>
          {hidden ? null : (
            <motion.nav
              id="mobile-nav"
              className="bg-page/80 fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] left-1/2 z-65 flex h-16 max-w-md -translate-x-1/2 items-center justify-around rounded-full px-6 py-3 shadow-lg backdrop-blur-sm"
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            >
              {/* 滑动指示器 — 圆形 pills，跟随 activeIndex */}
              <motion.span
                className="bg-accent/10 absolute top-1/2 left-6 h-14 w-16 rounded-full"
                animate={{ x: activeIndex * NAV_ITEM_WIDTH, y: '-50%' }}
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />

              <NavItem icon={<Home className={ICON_SIZE} />} to="/" />

              <NavItem icon={<Newspaper className={ICON_SIZE} />} to="/blog" />

              <NavItem icon={<Rss className={ICON_SIZE} />} to="/rss" />

              {/* More */}
              <div className="flex items-center justify-center">
                <button
                  onClick={() => setShowMenu((v) => !v)}
                  className="text-muted hover:text-ink flex h-14 w-16 items-center justify-center rounded-full transition duration-200 hover:scale-110 active:scale-[0.96]"
                  aria-label="更多导航"
                  aria-expanded={showMenu}
                >
                  {activeIndex === 3 ? (
                    <Grid2x2 className={ICON_SIZE} />
                  ) : (
                    <MoreHorizontal className={ICON_SIZE} />
                  )}
                </button>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </Fragment>
  );
}
