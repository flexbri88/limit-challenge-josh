'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

export type ParamUpdates = Record<string, string | number | null | undefined>;

/**
 * The URL query string as page state: shareable, bookmarkable and restored on
 * reload. Empty values are removed; changing anything other than `page`
 * returns to the first page so results never point past the end.
 */
export function useSearchParamsState() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const setParams = useCallback(
    (updates: ParamUpdates) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === '') next.delete(key);
        else next.set(key, String(value));
      }
      if (!('page' in updates)) next.delete('page');
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  return [searchParams, setParams] as const;
}

export const PAGE_SIZES = [10, 25, 50];

/** Page number (1-based) and page size from the URL, with safe defaults. */
export function readPagination(searchParams: URLSearchParams) {
  const page = Math.max(1, Math.floor(Number(searchParams.get('page'))) || 1);
  const requested = Number(searchParams.get('page_size'));
  const pageSize = PAGE_SIZES.includes(requested) ? requested : PAGE_SIZES[0];
  return { page, pageSize };
}

/** Props wiring MUI's TablePagination (0-based) to the URL (1-based, defaults omitted). */
export function paginationProps(
  count: number | undefined,
  { page, pageSize }: { page: number; pageSize: number },
  setParams: (updates: ParamUpdates) => void,
) {
  return {
    component: 'div' as const,
    count: count ?? 0,
    page: count === undefined ? 0 : page - 1,
    rowsPerPage: pageSize,
    rowsPerPageOptions: PAGE_SIZES,
    onPageChange: (_: unknown, next: number) => setParams({ page: next === 0 ? null : next + 1 }),
    onRowsPerPageChange: (event: { target: { value: string } }) =>
      setParams({
        page_size: Number(event.target.value) === PAGE_SIZES[0] ? null : event.target.value,
      }),
  };
}

/**
 * The page to show after deleting a row: step back when the last row of a
 * page past the first was removed, so the list never lands on a missing page.
 * Returns a `page` URL value (null means the first page).
 */
export function pageAfterDelete(rowsOnPage: number, page: number): number | null {
  const next = rowsOnPage <= 1 && page > 1 ? page - 1 : page;
  return next === 1 ? null : next;
}
