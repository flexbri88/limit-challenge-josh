import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { mechanicsApi } from '@/lib/api';
import type { MechanicInput } from '@/lib/types';
import { invalidateAfterWrite, queryKeys } from './query-keys';

export function useMechanics(params: { page: number; page_size: number; is_active?: string }) {
  return useQuery({
    queryKey: queryKeys.mechanics.list(params),
    queryFn: () => mechanicsApi.list(params),
    placeholderData: keepPreviousData,
  });
}

/** Active mechanics for assigning new maintenance work. */
export function useActiveMechanicOptions() {
  return useQuery({
    queryKey: queryKeys.mechanics.options,
    queryFn: async () =>
      (await mechanicsApi.list({ is_active: true, page_size: 100, ordering: 'name' })).results,
    staleTime: 5 * 60_000,
  });
}

export function useMechanicWorkload() {
  return useQuery({ queryKey: queryKeys.mechanics.workload, queryFn: mechanicsApi.workload });
}

export function useSaveMechanic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: MechanicInput }) =>
      id ? mechanicsApi.update(id, input) : mechanicsApi.create(input),
    onSuccess: () => invalidateAfterWrite(queryClient, 'mechanics'),
  });
}

export function useDeleteMechanic() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: mechanicsApi.remove,
    onSuccess: () => invalidateAfterWrite(queryClient, 'mechanics'),
  });
}
