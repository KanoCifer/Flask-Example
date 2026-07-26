import { TrackEvent } from '@/lib/visitorTracker';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Outlet } from 'react-router-dom';
import { BackToTop } from './components/BackToTop';
import { BasicNav } from './components/BasicNav';
import { BentoNavSidebar } from './components/BasicSidebar';
import { CookieConsent } from './components/CookieConsent';
import { NavVisibilityProvider } from './components/NavVisibilityContext';
import { Notifier } from './components/NotificationContainer';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function BasicLayout() {
  return (
    <NavVisibilityProvider>
      <TrackEvent />
      <BentoNavSidebar />
      <div className="relative isolate grid min-h-dvh grid-rows-[auto_1fr_auto]">
        <header>
          <BasicNav />
        </header>
        <ScrollToTop />
        <main className="relative max-w-dvw scroll-smooth">
          <Outlet />
        </main>
        <BackToTop />
      </div>

      <CookieConsent />
      {createPortal(<Notifier />, document.body)}
    </NavVisibilityProvider>
  );
}
