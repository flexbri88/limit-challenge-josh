import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { maintenanceRecordsApi } from '@/lib/api';
import type { ListParams, MaintenanceRecordInput } from '@/lib/types';
import { invalidateAfterWrite, queryKeys } from './query-keys';

export function useMaintenanceRecords(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.records.list(params),
    queryFn: () => maintenanceRecordsApi.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useSaveMaintenanceRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: MaintenanceRecordInput }) =>
      id ? maintenanceRecordsApi.update(id, input) : maintenanceRecordsApi.create(input),
    onSuccess: () => invalidateAfterWrite(queryClient, 'records'),
  });
}

export function useDeleteMaintenanceRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: maintenanceRecordsApi.remove,
    onSuccess: () => invalidateAfterWrite(queryClient, 'records'),
  });
}
