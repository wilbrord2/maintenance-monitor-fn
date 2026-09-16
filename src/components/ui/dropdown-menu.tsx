'use client';

import * as MenuPrimitive from '@radix-ui/react-dropdown-menu';
import { type LucideIcon } from 'lucide-react';
import { type ComponentProps } from 'react';
import { cn } from '@/lib/utils/cn';

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;
export const DropdownMenuGroup = MenuPrimitive.Group;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  align = 'end',
  ...props
}: ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(
          'z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-48 overflow-y-auto rounded-lg border border-line bg-panel p-1 shadow-overlay',
          'data-[state=closed]:animate-pop-out data-[state=open]:animate-pop-in',
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

export interface DropdownMenuItemProps extends ComponentProps<typeof MenuPrimitive.Item> {
  icon?: LucideIcon;
  tone?: 'default' | 'danger';
}

export function DropdownMenuItem({ icon: Icon, tone = 'default', className, children, ...props }: DropdownMenuItemProps) {
  return (
    <MenuPrimitive.Item
      className={cn(
        'flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-[13px] outline-none select-none',
        'data-disabled:pointer-events-none data-disabled:opacity-50',
        tone === 'danger' ? 'text-critical-ink data-highlighted:bg-critical-soft' : 'text-ink data-highlighted:bg-hover',
        className,
      )}
      {...props}
    >
      {Icon ? <Icon className="size-4 shrink-0 opacity-80" aria-hidden /> : null}
      {children}
    </MenuPrimitive.Item>
  );
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof MenuPrimitive.Label>) {
  return <MenuPrimitive.Label className={cn('px-2 py-1.5 text-xs text-muted', className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className={cn('-mx-1 my-1 h-px bg-line', className)} {...props} />;
}
