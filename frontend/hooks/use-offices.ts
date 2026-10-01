import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { officesApi } from '@/lib/api';
import type { OfficeInput } from '@/lib/types';
import { invalidateAfterWrite, queryKeys } from './query-keys';

export function useOffices(params: { page: number; page_size: number }) {
  return useQuery({
    queryKey: queryKeys.offices.list(params),
    queryFn: () => officesApi.list(params),
    placeholderData: keepPreviousData,
  });
}

/** All offices for select inputs (fleets have tens of offices, not thousands). */
export function useOfficeOptions() {
  return useQuery({
    queryKey: queryKeys.offices.options,
    queryFn: async () => (await officesApi.list({ page_size: 100, ordering: 'name' })).results,
    staleTime: 5 * 60_000,
  });
}

export function useOfficeSummary() {
  return useQuery({ queryKey: queryKeys.offices.summary, queryFn: officesApi.summary });
}

export function useSaveOffice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: OfficeInput }) =>
      id ? officesApi.update(id, input) : officesApi.create(input),
    onSuccess: () => invalidateAfterWrite(queryClient, 'offices'),
  });
}

export function useDeleteOffice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: officesApi.remove,
    onSuccess: () => invalidateAfterWrite(queryClient, 'offices'),
  });
}
