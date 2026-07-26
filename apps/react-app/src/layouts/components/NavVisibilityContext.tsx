import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

const SCROLL_THRESHOLD = 10;

interface NavVisibilityContextType {
  hidden: boolean;
  hideNav: () => void;
  showNav: () => void;
}

const NavVisibilityContext = createContext<NavVisibilityContextType | null>(
  null,
);

export function NavVisibilityProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const lastScrollY = useRef(window.scrollY);
  const ticking = useRef(false);

  const hideNav = useCallback(() => setHidden(true), []);
  const showNav = useCallback(() => setHidden(false), []);

  useEffect(() => {
    const handleScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const diff = currentScrollY - lastScrollY.current;

          if (currentScrollY < lastScrollY.current) {
            setHidden(false);
          } else if (diff > SCROLL_THRESHOLD) {
            setHidden(true);
          }

          lastScrollY.current = currentScrollY;
          ticking.current = false;
        });
        ticking.current = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const value = useMemo(
    () => ({ hidden, hideNav, showNav }),
    [hidden, hideNav, showNav],
  );

  return (
    <NavVisibilityContext.Provider value={value}>
      {children}
    </NavVisibilityContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useNavVisibility = () => {
  const ctx = useContext(NavVisibilityContext);
  if (!ctx)
    throw new Error(
      'useNavVisibility must be used within NavVisibilityProvider',
    );
  return ctx;
};
