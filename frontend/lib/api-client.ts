import axios, { isAxiosError, type InternalAxiosRequestConfig } from 'axios';
import { getTokens, setTokens } from './auth';
import type { AuthTokens } from './types';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api';

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15_000,
});

/** Token endpoints take credentials in the body and must never trigger a refresh. */
function isTokenEndpoint(url = '') {
  return url.startsWith('/auth/token/') || url.startsWith('/auth/logout/');
}

apiClient.interceptors.request.use((config) => {
  const tokens = getTokens();
  if (tokens && !isTokenEndpoint(config.url)) {
    config.headers.Authorization = `Bearer ${tokens.access}`;
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

/**
 * Trade the refresh token for a new pair. Concurrent 401s share one request, since
 * the refresh token rotates and a second use of the old one would be rejected.
 * Resolves to null when the session is over (the tokens are then cleared, which
 * sends the user to the login page); network errors reject as usual.
 */
export function refreshAccessToken(): Promise<string | null> {
  refreshing ??= (async () => {
    const current = getTokens();
    if (!current) return null;
    try {
      const { data } = await apiClient.post<AuthTokens>('/auth/token/refresh/', {
        refresh: current.refresh,
      });
      setTokens(data);
      return data.access;
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        setTokens(null);
        return null;
      }
      throw error;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

type RetriableConfig = InternalAxiosRequestConfig & { _authRetried?: boolean };

apiClient.interceptors.response.use(undefined, async (error: unknown) => {
  const config = isAxiosError(error) ? (error.config as RetriableConfig | undefined) : undefined;
  if (
    !isAxiosError(error) ||
    error.response?.status !== 401 ||
    !config ||
    config._authRetried ||
    isTokenEndpoint(config.url)
  ) {
    throw error;
  }
  const current = getTokens();
  if (!current) throw error;

  config._authRetried = true;
  // Another request may have refreshed the tokens while this one was in flight.
  const sentStaleToken = config.headers.Authorization !== `Bearer ${current.access}`;
  if (!sentStaleToken && !(await refreshAccessToken())) throw error;
  return apiClient(config);
});
