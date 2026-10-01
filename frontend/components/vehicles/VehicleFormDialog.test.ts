import { describe, expect, it } from 'vitest';
import type { VehicleInput } from '@/lib/types';
import { changedFields } from './VehicleFormDialog';

const vehicle: VehicleInput = {
  vin: '1HGCM82633A004352',
  license_plate: 'ABC-123',
  make: 'Ford',
  model: 'Transit',
  year: 2022,
  office: 1,
  is_active: true,
};

describe('changedFields', () => {
  it('returns only the fields the user changed', () => {
    expect(changedFields(vehicle, { ...vehicle, model: 'Transit Connect', year: 2023 })).toEqual({
      model: 'Transit Connect',
      year: 2023,
    });
  });

  it('leaves out the office unless it was edited, so a concurrent move is kept', () => {
    expect(changedFields(vehicle, { ...vehicle, make: 'Ram' })).not.toHaveProperty('office');
  });

  it('is empty when nothing changed', () => {
    expect(changedFields(vehicle, { ...vehicle })).toEqual({});
  });
});
