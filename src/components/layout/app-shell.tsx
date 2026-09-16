'use client';

import { Menu } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode } from 'react';
import { RouteAccessGuard } from '@/components/auth/guards';
import { OfflineBanner } from '@/components/feedback/offline-banner';
import { LiveIndicator } from '@/components/status/live-indicator';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/constants/routes';
import { useUiStore } from '@/stores/ui-store';
import { BrandMark } from './brand-mark';
import { GlobalSearch } from './global-search';
import { NotificationsMenu } from './notifications-menu';
import { MobileNav, Sidebar } from './sidebar';
import { UserMenu } from './user-menu';

function AppHeader() {
  const setMobileNavOpen = useUiStore((state) => state.setMobileNavOpen);
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line bg-panel px-3 sm:gap-3 sm:px-5 lg:px-8">
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}>
        <Menu className="size-5" aria-hidden />
      </Button>
      <Link href={ROUTES.dashboard} className="hidden rounded-md sm:block lg:hidden">
        <BrandMark iconOnly />
      </Link>
      <div className="min-w-0 flex-1">
        <GlobalSearch />
      </div>
      <LiveIndicator className="hidden sm:inline-flex" />
      <NotificationsMenu />
      <UserMenu />
    </header>
  );
}

/** Signed-in application frame: sidebar, header, and the permission-checked page area. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-paper">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-panel focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-overlay"
      >
        Skip to main content
      </a>
      <Sidebar />
      <MobileNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <OfflineBanner />
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1440px] min-w-0 flex-1 px-4 py-5 outline-none sm:px-6 sm:py-6 lg:px-8">
          <RouteAccessGuard>{children}</RouteAccessGuard>
        </main>
      </div>
    </div>
  );
}
