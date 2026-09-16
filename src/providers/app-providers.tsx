'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { type ReactNode, useState } from 'react';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { createQueryClient } from '@/lib/query/query-client';
import { SessionProvider } from './session-provider';

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Animations follow the operating system's reduced-motion preference. */}
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={300}>
          <SessionProvider>{children}</SessionProvider>
        </TooltipProvider>
      </MotionConfig>
      <Toaster
        position="top-right"
        closeButton
        visibleToasts={4}
        duration={5000}
        toastOptions={{
          classNames: {
            toast: '!rounded-lg !border-line !font-sans !shadow-overlay',
            title: '!text-[13px] !font-semibold !text-ink',
            description: '!text-[13px] !text-muted',
          },
        }}
      />
    </QueryClientProvider>
  );
}
