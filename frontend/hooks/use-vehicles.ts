import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { vehiclesApi } from '@/lib/api';
import type { ListParams, VehicleInput, VehicleSearchParams } from '@/lib/types';
import { invalidateAfterWrite, queryKeys } from './query-keys';

export function useVehicleSearch(params: VehicleSearchParams) {
  return useQuery({
    queryKey: queryKeys.vehicles.search(params),
    queryFn: () => vehiclesApi.search(params),
    // Keep showing the previous page while the next filter/page loads.
    placeholderData: keepPreviousData,
  });
}

export function useVehicleDetail(id: number) {
  return useQuery({
    queryKey: queryKeys.vehicles.detail(id),
    queryFn: () => vehiclesApi.detail(id),
    enabled: Number.isInteger(id) && id > 0,
  });
}

export function useVehiclesNeedingMaintenance(params: ListParams) {
  return useQuery({
    queryKey: queryKeys.vehicles.needsMaintenance(params),
    queryFn: () => vehiclesApi.needsMaintenance(params),
    placeholderData: keepPreviousData,
  });
}

export function useSaveVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    // Updates may be partial (only changed fields); creates are always complete.
    mutationFn: ({ id, input }: { id?: number; input: Partial<VehicleInput> }) =>
      id ? vehiclesApi.update(id, input) : vehiclesApi.create(input as VehicleInput),
    onSuccess: () => invalidateAfterWrite(queryClient, 'vehicles'),
  });
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: vehiclesApi.remove,
    onSuccess: (_, id) => {
      // Drop the deleted vehicle's detail instead of refetching it into a 404.
      queryClient.removeQueries({ queryKey: queryKeys.vehicles.detail(id) });
      return invalidateAfterWrite(queryClient, 'vehicles');
    },
  });
}

export function useAssignVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, office }: { id: number; office: number }) => vehiclesApi.assign(id, office),
    onSuccess: () => invalidateAfterWrite(queryClient, 'vehicles'),
  });
}

interface DuplicateCheckParams {
  vin: string;
  license_plate: string;
  exclude?: number;
  is_active: boolean;
}

/** Warn about VIN/plate collisions before submitting (the API still enforces them). */
export function useDuplicateCheck(params: DuplicateCheckParams) {
  return useQuery({
    queryKey: [...queryKeys.vehicles.all, 'duplicate-check', params],
    queryFn: () => vehiclesApi.checkDuplicate(params),
    enabled: Boolean(params.vin || params.license_plate),
    staleTime: 10_000,
  });
}
