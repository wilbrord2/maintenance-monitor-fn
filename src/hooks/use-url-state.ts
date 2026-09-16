'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

export type UrlParamUpdates = Record<string, string | number | null | undefined>;

export interface SetParamsOptions {
  /** Return to the first page (use when filters change). */
  resetPage?: boolean;
  /** `push` adds a history entry (pagination); `replace` does not (typing, filters). */
  history?: 'push' | 'replace';
}

/**
 * Filters, search, sorting and pagination live in the URL so views are shareable, bookmarkable
 * and survive a refresh.
 */
export function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParams = useCallback(
    (updates: UrlParamUpdates, options: SetParamsOptions = {}) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === '') next.delete(key);
        else next.set(key, String(value));
      }
      if (options.resetPage) next.delete('page');
      const query = next.toString();
      const href = query ? `${pathname}?${query}` : pathname;
      if (options.history === 'push') router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const clearParams = useCallback(
    (keys: readonly string[]) => setParams(Object.fromEntries(keys.map((key) => [key, null]))),
    [setParams],
  );

  return { searchParams, setParams, clearParams };
}
