'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { getNavigationForRole, isNavItemActive, type NavItem } from '@/config/navigation';
import { usePermissions } from '@/lib/permissions/use-permissions';
import { cn } from '@/lib/utils/cn';

interface SidebarLinkProps {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?(): void;
}

function SidebarLink({ item, active, collapsed, onNavigate }: SidebarLinkProps) {
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex h-9 items-center gap-3 rounded-md px-3 text-[13px] font-medium transition-colors focus-visible:outline-amber',
        active ? 'bg-sidebar-active text-white' : 'text-sidebar-ink hover:bg-sidebar-hover hover:text-white',
        collapsed && 'justify-center px-0',
      )}
    >
      {active ? (
        <motion.span
          layoutId="sidebar-active-indicator"
          className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-sm bg-amber"
          transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
          aria-hidden
        />
      ) : null}
      <Icon className="size-[18px] shrink-0" aria-hidden />
      <span className={cn('truncate', collapsed && 'sr-only')}>{item.label}</span>
    </Link>
  );
  return collapsed ? (
    <Tooltip content={item.label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}

/** Role-aware navigation: only sections and items the user may open are rendered. */
export function SidebarNav({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?(): void }) {
  const pathname = usePathname();
  const { role } = usePermissions();
  const sections = useMemo(() => getNavigationForRole(role), [role]);

  return (
    <nav aria-label="Main" className="flex flex-col">
      {sections.map((section) => (
        <div key={section.id} className="flex flex-col">
          {section.label ? (
            collapsed ? (
              <div className="mx-3 my-3 h-px bg-sidebar-line" role="presentation" />
            ) : (
              <p className="px-3 pt-5 pb-1.5 font-mono text-[10.5px] tracking-[0.14em] text-sidebar-muted uppercase">
                {section.label}
              </p>
            )
          ) : null}
          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => (
              <li key={item.href}>
                <SidebarLink item={item} active={isNavItemActive(item, pathname)} collapsed={collapsed} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
