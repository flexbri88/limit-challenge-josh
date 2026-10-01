import type { QueryClient } from '@tanstack/react-query';

export const queryKeys = {
  currentUser: ['current-user'] as const,
  offices: {
    all: ['offices'] as const,
    list: (params: object) => ['offices', 'list', params] as const,
    options: ['offices', 'options'] as const,
    summary: ['offices', 'summary'] as const,
  },
  mechanics: {
    all: ['mechanics'] as const,
    list: (params: object) => ['mechanics', 'list', params] as const,
    options: ['mechanics', 'options'] as const,
    workload: ['mechanics', 'workload'] as const,
  },
  vehicles: {
    all: ['vehicles'] as const,
    search: (params: object) => ['vehicles', 'search', params] as const,
    detail: (id: number) => ['vehicles', 'detail', id] as const,
    needsMaintenance: (params: object) => ['vehicles', 'needs-maintenance', params] as const,
  },
  records: {
    all: ['records'] as const,
    list: (params: object) => ['records', 'list', params] as const,
  },
};

type Resource = Exclude<keyof typeof queryKeys, 'currentUser'>;

/**
 * Which cached resources can change when a resource is written. Reports live
 * under their owning resource (office summary under offices, workload under
 * mechanics, needs-maintenance under vehicles), so they refresh too.
 */
const AFFECTED_BY: Record<Resource, Resource[]> = {
  offices: ['offices', 'vehicles'],
  vehicles: ['vehicles', 'offices', 'records'],
  mechanics: ['mechanics', 'records', 'vehicles'],
  records: ['records', 'vehicles', 'offices', 'mechanics'],
};

export function invalidateAfterWrite(queryClient: QueryClient, resource: Resource) {
  return Promise.all(
    AFFECTED_BY[resource].map((key) =>
      queryClient.invalidateQueries({ queryKey: queryKeys[key].all }),
    ),
  );
}
