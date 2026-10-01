import { apiClient } from './api-client';
import type {
  AuthTokens,
  CurrentUser,
  DuplicateCheckResult,
  ListParams,
  MaintenanceHistoryEntry,
  MaintenanceRecord,
  MaintenanceRecordInput,
  Mechanic,
  MechanicInput,
  MechanicWorkloadReport,
  Office,
  OfficeInput,
  OfficeSummary,
  Paginated,
  Vehicle,
  VehicleDetail,
  VehicleInput,
  VehicleMaintenanceDue,
  VehicleSearchParams,
} from './types';

/** Drop empty values so they never reach the query string as `?office=`. */
export function cleanParams(params: object = {}): ListParams {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  );
}

function crudResource<T, Input>(path: string) {
  return {
    list: async (params?: object) =>
      (await apiClient.get<Paginated<T>>(`/${path}/`, { params: cleanParams(params) })).data,
    get: async (id: number) => (await apiClient.get<T>(`/${path}/${id}/`)).data,
    create: async (input: Input) => (await apiClient.post<T>(`/${path}/`, input)).data,
    update: async (id: number, input: Partial<Input>) =>
      (await apiClient.patch<T>(`/${path}/${id}/`, input)).data,
    remove: async (id: number) => {
      await apiClient.delete(`/${path}/${id}/`);
    },
  };
}

export const officesApi = {
  ...crudResource<Office, OfficeInput>('offices'),
  summary: async () => (await apiClient.get<OfficeSummary[]>('/offices/summary/')).data,
};

export const mechanicsApi = {
  ...crudResource<Mechanic, MechanicInput>('mechanics'),
  workload: async () => (await apiClient.get<MechanicWorkloadReport>('/mechanics/workload/')).data,
};

export const vehiclesApi = {
  ...crudResource<Vehicle, VehicleInput>('vehicles'),
  search: async (params: VehicleSearchParams) =>
    (await apiClient.get<Paginated<Vehicle>>('/vehicles/', { params: cleanParams(params) })).data,
  detail: async (id: number) => (await apiClient.get<VehicleDetail>(`/vehicles/${id}/`)).data,
  history: async (id: number, params?: ListParams) =>
    (
      await apiClient.get<Paginated<MaintenanceHistoryEntry>>(
        `/vehicles/${id}/maintenance-history/`,
        { params: cleanParams(params) },
      )
    ).data,
  assign: async (id: number, office: number) =>
    (await apiClient.post<Vehicle>(`/vehicles/${id}/assign/`, { office })).data,
  needsMaintenance: async (params?: ListParams) =>
    (
      await apiClient.get<Paginated<VehicleMaintenanceDue>>('/vehicles/needs-maintenance/', {
        params: cleanParams(params),
      })
    ).data,
  checkDuplicate: async (params: {
    vin?: string;
    license_plate?: string;
    exclude?: number;
    is_active?: boolean;
  }) =>
    (
      await apiClient.get<DuplicateCheckResult>('/vehicles/check-duplicate/', {
        params: cleanParams(params),
      })
    ).data,
};

export const maintenanceRecordsApi = crudResource<MaintenanceRecord, MaintenanceRecordInput>(
  'maintenance-records',
);

export const authApi = {
  login: async (credentials: { username: string; password: string }) =>
    (await apiClient.post<AuthTokens>('/auth/token/', credentials)).data,
  /** Revokes the refresh token; the short-lived access token simply expires. */
  logout: async (refresh: string) => {
    await apiClient.post('/auth/logout/', { refresh });
  },
  me: async () => (await apiClient.get<CurrentUser>('/auth/me/')).data,
};
