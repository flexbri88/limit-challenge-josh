import { describe, expect, it } from 'vitest';
import { cleanParams } from './api';

describe('cleanParams', () => {
  it('drops empty values so they never reach the query string', () => {
    expect(
      cleanParams({ office: '', make: 'Ford', model: undefined, search: null, page: 1 }),
    ).toEqual({ make: 'Ford', page: 1 });
  });

  it('keeps meaningful falsy values', () => {
    expect(cleanParams({ is_active: false, page: 0 })).toEqual({ is_active: false, page: 0 });
  });
});
