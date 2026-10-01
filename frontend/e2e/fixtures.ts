import { test as base, expect, type APIRequestContext } from '@playwright/test';
import type { AuthTokens, MaintenanceRecord, Mechanic, Office, Vehicle } from '../lib/types';

export const API_PORT = 8100;
export const API_URL = `http://127.0.0.1:${API_PORT}/api`;

/** Created by `manage.py seed`, which start-api.mjs runs before the suite. */
export const DEMO_USER = { username: 'demo', password: 'demo1234' };
/** Must match lib/auth.ts. */
export const TOKEN_STORAGE_KEY = 'fleet.auth';

export async function obtainTokens(request: APIRequestContext): Promise<AuthTokens> {
  const response = await request.post(`${API_URL}/auth/token/`, { data: DEMO_USER });
  expect(response.ok(), `sign in: ${await response.text()}`).toBeTruthy();
  return response.json();
}

/** A browser storage state that starts the page with these tokens (or signed out). */
export function sessionState(baseURL: string, tokens: AuthTokens | null) {
  return {
    cookies: [],
    origins: tokens
      ? [
          {
            origin: baseURL,
            localStorage: [{ name: TOKEN_STORAGE_KEY, value: JSON.stringify(tokens) }],
          },
        ]
      : [],
  };
}

let sequence = 0;
/** Unique suffix so tests never collide with seed data or each other. */
export function uid(): string {
  sequence += 1;
  return `${Date.now().toString(36)}${sequence}`.toUpperCase().slice(-7);
}

const VIN_ALPHABET = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
export function randomVin(): string {
  return Array.from({ length: 17 }, () => VIN_ALPHABET[Math.floor(Math.random() * 33)]).join('');
}

export function isoDate(daysFromToday = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromToday);
  return date.toISOString().slice(0, 10);
}

/** Arrange test data through the API, so tests only drive the UI for what they verify. */
function createApi(request: APIRequestContext, tokens: AuthTokens) {
  async function post<T>(path: string, data: object): Promise<T> {
    const response = await request.post(`${API_URL}${path}`, {
      data,
      headers: { Authorization: `Bearer ${tokens.access}` },
    });
    expect(response.ok(), `POST ${path}: ${await response.text()}`).toBeTruthy();
    return response.json();
  }

  return {
    office: (overrides: Partial<Office> = {}) =>
      post<Office>('/offices/', { name: `E2E Office ${uid()}`, city: 'Testville', ...overrides }),
    mechanic: (overrides: Partial<Mechanic> = {}) =>
      post<Mechanic>('/mechanics/', {
        name: `E2E Mechanic ${uid()}`,
        certification_number: `E2E-${uid()}`,
        ...overrides,
      }),
    vehicle: (office: number, overrides: Partial<Vehicle> = {}) =>
      post<Vehicle>('/vehicles/', {
        vin: randomVin(),
        license_plate: `E2E-${uid()}`,
        make: 'Ford',
        model: 'Transit',
        year: 2022,
        office,
        ...overrides,
      }),
    record: (vehicle: number, mechanic: number, overrides: Record<string, unknown> = {}) =>
      post<MaintenanceRecord>('/maintenance-records/', {
        vehicle,
        mechanic,
        date: isoDate(),
        maintenance_type: 'inspection',
        cost: '100.00',
        ...overrides,
      }),
  };
}

export const test = base.extend<{ tokens: AuthTokens; api: ReturnType<typeof createApi> }>({
  // Named `provide` rather than Playwright's usual `use`, which the React hooks lint rule flags.
  tokens: async ({ request }, provide) => {
    await provide(await obtainTokens(request));
  },
  // Every test starts signed in with its own tokens (auth.spec.ts overrides this), so
  // one test refreshing or revoking its tokens cannot affect another.
  storageState: async ({ baseURL, tokens }, provide) => {
    await provide(sessionState(baseURL!, tokens));
  },
  api: async ({ request, tokens }, provide) => {
    await provide(createApi(request, tokens));
  },
});

export { expect };
