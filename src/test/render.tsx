import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionConfig } from 'framer-motion';
import { type ReactElement, type ReactNode } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Number.POSITIVE_INFINITY, staleTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(ui: ReactElement, options: { queryClient?: QueryClient } & Omit<RenderOptions, 'wrapper'> = {}) {
  const { queryClient = createTestQueryClient(), ...renderOptions } = options;

  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="always">
          <TooltipProvider>{children}</TooltipProvider>
        </MotionConfig>
      </QueryClientProvider>
    );
  }

  return { user: userEvent.setup(), queryClient, ...render(ui, { wrapper: Providers, ...renderOptions }) };
}
