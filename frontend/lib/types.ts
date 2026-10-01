export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Office {
  id: number;
  name: string;
  city: string;
}

export type OfficeInput = Omit<Office, 'id'>;

export interface OfficeSummary extends Office {
  active_vehicle_count: number;
  maintenance_cost_last_year: number;
  last_maintenance: string | null;
}

export interface Mechanic {
  id: number;
  name: string;
  certification_number: string;
  is_active: boolean;
}

export type MechanicInput = Omit<Mechanic, 'id'>;

export interface MechanicWorkload extends Mechanic {
  maintenance_count: number;
  total_maintenance_cost: number;
}

export interface MechanicWorkloadReport {
  year: number;
  results: MechanicWorkload[];
}

export interface Vehicle {
  id: number;
  vin: string;
  license_plate: string;
  make: string;
  model: string;
  year: number;
  office: number;
  office_name: string;
  is_active: boolean;
}

export type VehicleInput = Omit<Vehicle, 'id' | 'office_name'>;

export const MAINTENANCE_TYPES = [
  { value: 'oil_change', label: 'Oil change' },
  { value: 'tires', label: 'Tires' },
  { value: 'brakes', label: 'Brakes' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'engine', label: 'Engine' },
  { value: 'battery', label: 'Battery' },
  { value: 'repair', label: 'General repair' },
  { value: 'other', label: 'Other' },
] as const;

export type MaintenanceType = (typeof MAINTENANCE_TYPES)[number]['value'];

export interface MaintenanceRecord {
  id: number;
  vehicle: number;
  vehicle_license_plate: string;
  mechanic: number;
  mechanic_name: string;
  date: string;
  maintenance_type: MaintenanceType;
  cost: number;
  notes: string;
}

export type MaintenanceRecordInput = Omit<
  MaintenanceRecord,
  'id' | 'vehicle_license_plate' | 'mechanic_name' | 'cost'
> & { cost: string };

export interface MaintenanceHistoryEntry {
  id: number;
  date: string;
  maintenance_type: MaintenanceType;
  maintenance_type_display: string;
  cost: number;
  notes: string;
  mechanic: Mechanic;
}

export interface VehicleDetail extends Vehicle {
  office_detail: Office;
  maintenance_count: number;
  total_maintenance_cost: number;
  last_maintenance: string | null;
  maintenance_records: MaintenanceHistoryEntry[];
}

export interface VehicleMaintenanceDue extends Vehicle {
  last_maintenance: string | null;
  days_since_last_maintenance: number | null;
}

export interface DuplicateCheckResult {
  conflicts: Array<'vin' | 'license_plate'>;
}

/** Query parameters accepted by GET /vehicles/ (all optional, combinable). */
export interface VehicleSearchParams {
  search?: string;
  office?: string;
  is_active?: string;
  make?: string;
  model?: string;
  maintained_from?: string;
  maintained_to?: string;
  mechanic_certification?: string;
  ordering?: string;
  page?: number;
  page_size?: number;
}

export type ListParams = Record<string, string | number | boolean | undefined | null>;

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface CurrentUser {
  id: number;
  username: string;
  full_name: string;
}
