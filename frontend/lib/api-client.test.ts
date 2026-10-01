import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiClient } from './api-client';
import { getTokens, setTokens } from './auth';

type Reply = { status: number; data?: unknown } | 'network-error';
type Handler = (config: InternalAxiosRequestConfig) => Reply;

const rotated = { access: 'access-2', refresh: 'refresh-2' };

function authorization(config: InternalAxiosRequestConfig) {
  return (AxiosHeaders.from(config.headers).get('Authorization') as string | null) ?? undefined;
}

/** A fake transport: records every request and answers through `handler`. */
function fakeServer(handler: Handler) {
  const requests: { url: string; authorization: string | undefined; body: unknown }[] = [];
  const adapter: AxiosAdapter = async (config) => {
    requests.push({
      url: config.url ?? '',
      authorization: authorization(config),
      body: config.data ? JSON.parse(config.data) : undefined,
    });
    await Promise.resolve(); // lets concurrent requests interleave
    const reply = handler(config);
    if (reply === 'network-error') {
      throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
    }
    const response: AxiosResponse = {
      data: reply.data ?? {},
      status: reply.status,
      statusText: '',
      headers: {},
      config,
    };
    if (reply.status >= 400) {
      throw new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, null, response);
    }
    return response;
  };
  apiClient.defaults.adapter = adapter;
  return requests;
}

/** Accepts only the `valid` access token; the refresh endpoint answers with `refresh`. */
function apiAccepting(valid: string, refresh: Reply = { status: 200, data: rotated }): Handler {
  return (config) => {
    if (config.url === '/auth/token/refresh/') return refresh;
    return authorization(config) === `Bearer ${valid}`
      ? { status: 200, data: { ok: true } }
      : { status: 401 };
  };
}

describe('apiClient authentication', () => {
  const originalAdapter = apiClient.defaults.adapter;

  beforeEach(() => setTokens({ access: 'access-1', refresh: 'refresh-1' }));
  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
    setTokens(null);
  });

  it('sends the access token, but not to the token endpoints', async () => {
    const requests = fakeServer(() => ({ status: 200 }));

    await apiClient.get('/vehicles/');
    await apiClient.post('/auth/token/', { username: 'demo', password: 'x' });

    expect(requests.map((request) => request.authorization)).toEqual([
      'Bearer access-1',
      undefined,
    ]);
  });

  it('refreshes an expired access token and retries the request', async () => {
    const requests = fakeServer(apiAccepting('access-2'));

    const response = await apiClient.get('/vehicles/');

    expect(response.data).toEqual({ ok: true });
    expect(getTokens()).toEqual(rotated);
    expect(requests.map((request) => request.url)).toEqual([
      '/vehicles/',
      '/auth/token/refresh/',
      '/vehicles/',
    ]);
    expect(requests[1]).toMatchObject({ authorization: undefined, body: { refresh: 'refresh-1' } });
    expect(requests[2].authorization).toBe('Bearer access-2');
  });

  it('shares one refresh between concurrent requests', async () => {
    const requests = fakeServer(apiAccepting('access-2'));

    await Promise.all([
      apiClient.get('/vehicles/'),
      apiClient.get('/offices/'),
      apiClient.get('/'),
    ]);

    expect(requests.filter((request) => request.url === '/auth/token/refresh/')).toHaveLength(1);
  });

  it('retries without refreshing when another request already renewed the token', async () => {
    const requests = fakeServer((config) => {
      setTokens(rotated); // renewed while this request was in flight
      return apiAccepting('access-2')(config);
    });

    await apiClient.get('/vehicles/');

    expect(requests.map((request) => request.url)).toEqual(['/vehicles/', '/vehicles/']);
  });

  it('ends the session when the refresh token is rejected', async () => {
    fakeServer(apiAccepting('access-2', { status: 401 }));

    await expect(apiClient.get('/vehicles/')).rejects.toMatchObject({ response: { status: 401 } });
    expect(getTokens()).toBeNull();
  });

  it('keeps the session when the refresh fails for another reason', async () => {
    fakeServer(apiAccepting('access-2', 'network-error'));

    await expect(apiClient.get('/vehicles/')).rejects.toMatchObject({ code: 'ERR_NETWORK' });
    expect(getTokens()).toEqual({ access: 'access-1', refresh: 'refresh-1' });
  });

  it('gives up after one retry instead of looping', async () => {
    const requests = fakeServer(apiAccepting('never-valid'));

    await expect(apiClient.get('/vehicles/')).rejects.toMatchObject({ response: { status: 401 } });
    expect(requests).toHaveLength(3);
  });

  it('does not try to refresh when signed out', async () => {
    setTokens(null);
    const requests = fakeServer(() => ({ status: 401 }));

    await expect(apiClient.get('/vehicles/')).rejects.toBeInstanceOf(AxiosError);
    expect(requests).toEqual([{ url: '/vehicles/', authorization: undefined, body: undefined }]);
  });

  it('does not refresh when the login itself is rejected', async () => {
    const requests = fakeServer(() => ({ status: 401 }));

    await expect(apiClient.post('/auth/token/', {})).rejects.toBeInstanceOf(AxiosError);
    expect(requests).toHaveLength(1);
    expect(getTokens()).toEqual({ access: 'access-1', refresh: 'refresh-1' });
  });
});
