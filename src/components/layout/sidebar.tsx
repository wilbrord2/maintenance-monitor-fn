'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import Link from 'next/link';
import { Sheet } from '@/components/ui/sheet';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils/cn';
import { useUiStore } from '@/stores/ui-store';
import { BrandMark } from './brand-mark';
import { SidebarNav } from './sidebar-nav';

const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 64;

/** Desktop sidebar (≥1024px), collapsible to an icon rail. */
export function Sidebar() {
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      className="sticky top-0 hidden h-dvh shrink-0 flex-col overflow-hidden border-r border-sidebar-line bg-sidebar lg:flex"
    >
      <div className={cn('flex h-14 shrink-0 items-center border-b border-sidebar-line', collapsed ? 'justify-center' : 'px-4')}>
        <Link href={ROUTES.dashboard} className="rounded-md focus-visible:outline-amber">
          <BrandMark inverted iconOnly={collapsed} />
        </Link>
      </div>
      <div className="flex-1 overflow-x-hidden overflow-y-auto px-2 py-3">
        <SidebarNav collapsed={collapsed} />
      </div>
      <div className="shrink-0 border-t border-sidebar-line p-2">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'flex h-9 w-full items-center gap-3 rounded-md px-3 text-[13px] text-sidebar-muted hover:bg-sidebar-hover hover:text-white focus-visible:outline-amber',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed ? <PanelLeftOpen className="size-[18px]" aria-hidden /> : <PanelLeftClose className="size-[18px]" aria-hidden />}
          {collapsed ? null : <span>Collapse</span>}
        </button>
      </div>
    </motion.aside>
  );
}

/** Navigation drawer for phones and tablets. */
export function MobileNav() {
  const open = useUiStore((state) => state.mobileNavOpen);
  const setOpen = useUiStore((state) => state.setMobileNavOpen);

  return (
    <Sheet open={open} onOpenChange={setOpen} side="left" title="Navigation" hideHeader className="w-[min(86vw,18rem)] border-sidebar-line bg-sidebar">
      <div className="flex h-14 items-center justify-between border-b border-sidebar-line px-4">
        <BrandMark inverted />
        <DialogPrimitive.Close
          aria-label="Close navigation"
          className="inline-flex size-8 items-center justify-center rounded-md text-sidebar-ink hover:bg-sidebar-hover hover:text-white focus-visible:outline-amber"
        >
          <X className="size-4" aria-hidden />
        </DialogPrimitive.Close>
      </div>
      <div className="px-2 py-3">
        <SidebarNav onNavigate={() => setOpen(false)} />
      </div>
    </Sheet>
  );
}
