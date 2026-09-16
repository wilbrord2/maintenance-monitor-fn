import { vi } from 'vitest';

/**
 * Controllable stand-in for `next/navigation`. Use with:
 *   vi.mock('next/navigation', async () => (await import('@/test/navigation')).navigationModule);
 */
export const navigation = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
  pathname: '/dashboard',
  searchParams: new URLSearchParams(),
};

export function setNavigation(pathname: string, search = ''): void {
  navigation.push.mockReset();
  navigation.replace.mockReset();
  navigation.back.mockReset();
  navigation.pathname = pathname;
  navigation.searchParams = new URLSearchParams(search);
}

export const navigationModule = {
  useRouter: () => navigation,
  usePathname: () => navigation.pathname,
  useSearchParams: () => navigation.searchParams,
  redirect: vi.fn(),
  notFound: vi.fn(),
};
