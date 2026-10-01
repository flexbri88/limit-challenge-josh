// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  pageAfterDelete,
  paginationProps,
  readPagination,
  useSearchParamsState,
} from './use-search-params-state';

const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  query: '',
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: navigation.replace }),
  usePathname: () => '/vehicles',
  useSearchParams: () => new URLSearchParams(navigation.query),
}));

describe('readPagination', () => {
  it.each([
    ['', 1, 10],
    ['page=3&page_size=25', 3, 25],
    ['page=0', 1, 10],
    ['page=-4', 1, 10],
    ['page=abc', 1, 10],
    ['page=2.7', 2, 10],
    ['page_size=7', 1, 10], // not an offered size
    ['page_size=1000', 1, 10],
  ])('"%s" -> page %i, size %i', (query, page, pageSize) => {
    expect(readPagination(new URLSearchParams(query))).toEqual({ page, pageSize });
  });
});

describe('paginationProps', () => {
  it('maps the 1-based URL page to MUI 0-based pages and back', () => {
    const setParams = vi.fn();
    const props = paginationProps(42, { page: 3, pageSize: 10 }, setParams);

    expect(props.page).toBe(2);
    props.onPageChange(null, 0);
    expect(setParams).toHaveBeenLastCalledWith({ page: null }); // page 1 is the default
    props.onPageChange(null, 4);
    expect(setParams).toHaveBeenLastCalledWith({ page: 5 });
  });

  it('omits the default page size from the URL', () => {
    const setParams = vi.fn();
    const props = paginationProps(42, { page: 1, pageSize: 25 }, setParams);

    props.onRowsPerPageChange({ target: { value: '10' } });
    expect(setParams).toHaveBeenLastCalledWith({ page_size: null });
    props.onRowsPerPageChange({ target: { value: '50' } });
    expect(setParams).toHaveBeenLastCalledWith({ page_size: '50' });
  });

  it('shows page 1 while the count is unknown', () => {
    expect(paginationProps(undefined, { page: 4, pageSize: 10 }, vi.fn()).page).toBe(0);
  });
});

describe('pageAfterDelete', () => {
  it('steps back when the last row of a later page is deleted', () => {
    expect(pageAfterDelete(1, 3)).toBe(2);
    expect(pageAfterDelete(1, 2)).toBeNull(); // page 1 is the default
  });

  it('stays put when rows remain or on the first page', () => {
    expect(pageAfterDelete(5, 3)).toBe(3);
    expect(pageAfterDelete(1, 1)).toBeNull();
  });
});

describe('useSearchParamsState', () => {
  beforeEach(() => {
    navigation.replace.mockClear();
    navigation.query = 'make=Ford&page=3';
  });

  it('writes updates to the URL, removing empty values and resetting the page', () => {
    const { result } = renderHook(() => useSearchParamsState());

    act(() => result.current[1]({ office: 2, make: '' }));

    expect(navigation.replace).toHaveBeenCalledWith('/vehicles?office=2', { scroll: false });
  });

  it('keeps the other filters when changing page', () => {
    const { result } = renderHook(() => useSearchParamsState());

    act(() => result.current[1]({ page: 4 }));

    expect(navigation.replace).toHaveBeenCalledWith('/vehicles?make=Ford&page=4', {
      scroll: false,
    });
  });

  it('drops the query string entirely when nothing is left', () => {
    const { result } = renderHook(() => useSearchParamsState());

    act(() => result.current[1]({ make: null }));

    expect(navigation.replace).toHaveBeenCalledWith('/vehicles', { scroll: false });
  });
});
