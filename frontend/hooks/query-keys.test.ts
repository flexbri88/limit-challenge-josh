import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { invalidateAfterWrite } from './query-keys';

function invalidatedRoots(resource: Parameters<typeof invalidateAfterWrite>[1]) {
  const client = new QueryClient();
  const spy = vi.spyOn(client, 'invalidateQueries');
  void invalidateAfterWrite(client, resource);
  return spy.mock.calls.map(([filters]) => filters?.queryKey?.[0]);
}

describe('invalidateAfterWrite', () => {
  it('refreshes reports derived from maintenance records', () => {
    // Office summary lives under "offices", workload under "mechanics",
    // vehicle detail and needs-maintenance under "vehicles".
    expect(invalidatedRoots('records').sort()).toEqual([
      'mechanics',
      'offices',
      'records',
      'vehicles',
    ]);
  });

  it('refreshes vehicle rows when an office is renamed', () => {
    expect(invalidatedRoots('offices')).toContain('vehicles');
  });

  it('refreshes the office summary when a vehicle changes', () => {
    expect(invalidatedRoots('vehicles')).toContain('offices');
  });
});
