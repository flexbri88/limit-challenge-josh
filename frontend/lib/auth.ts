import type { AuthTokens } from './types';

/**
 * The signed-in session's JWTs. Kept in localStorage so a reload or a new tab stays
 * signed in; the tradeoff (any script on the page can read them) is in the README.
 * `undefined` means "not read yet" (the server render), `null` means signed out.
 */
const STORAGE_KEY = 'fleet.auth';

let tokens: AuthTokens | null | undefined;
const listeners = new Set<() => void>();

function storage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined; // blocked storage (privacy mode): the session lasts until reload
  }
}

function read(): AuthTokens | null {
  try {
    const parsed = JSON.parse(storage()?.getItem(STORAGE_KEY) ?? 'null');
    return typeof parsed?.access === 'string' && typeof parsed?.refresh === 'string'
      ? { access: parsed.access, refresh: parsed.refresh }
      : null;
  } catch {
    return null;
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

export function getTokens(): AuthTokens | null {
  if (tokens === undefined) tokens = read();
  return tokens;
}

export function setTokens(next: AuthTokens | null) {
  tokens = next;
  try {
    if (next) storage()?.setItem(STORAGE_KEY, JSON.stringify(next));
    else storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Keep the in-memory session even if it cannot be persisted.
  }
  emit();
}

/** Another tab signed in, out or refreshed the tokens. */
function onStorage(event: StorageEvent) {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  tokens = read();
  emit();
}

export function subscribeToTokens(listener: () => void) {
  if (listeners.size === 0 && typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
  };
}

/**
 * Where to go after signing in. Only same-site paths are allowed, so a crafted
 * `/login?next=https://evil.example` link cannot send the user elsewhere.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return '/';
  }
  return next === '/login' || next.startsWith('/login?') ? '/' : next;
}

/** The login URL that returns to `path` afterwards. */
export function loginPath(path: string): string {
  const next = safeNextPath(path);
  return next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`;
}
