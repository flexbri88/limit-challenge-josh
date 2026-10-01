import { afterEach, describe, expect, it, vi } from 'vitest';
import { getTokens, loginPath, safeNextPath, setTokens, subscribeToTokens } from './auth';

describe('safeNextPath', () => {
  it('keeps same-site paths with their query string', () => {
    expect(safeNextPath('/vehicles?make=ford&page=2')).toBe('/vehicles?make=ford&page=2');
  });

  it.each([null, '', 'https://evil.example', '//evil.example', '/\\evil.example', 'vehicles'])(
    'falls back to the dashboard for %j',
    (next) => {
      expect(safeNextPath(next)).toBe('/');
    },
  );

  it('never loops back to the login page', () => {
    expect(safeNextPath('/login')).toBe('/');
    expect(safeNextPath('/login?next=/vehicles')).toBe('/');
  });
});

describe('loginPath', () => {
  it('remembers where to return', () => {
    expect(loginPath('/vehicles?make=ford')).toBe('/login?next=%2Fvehicles%3Fmake%3Dford');
  });

  it('omits next for the dashboard', () => {
    expect(loginPath('/')).toBe('/login');
  });
});

describe('token store', () => {
  afterEach(() => setTokens(null));

  it('notifies subscribers when the session changes', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToTokens(listener);

    setTokens({ access: 'a', refresh: 'r' });
    expect(getTokens()).toEqual({ access: 'a', refresh: 'r' });
    setTokens(null);
    expect(getTokens()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    setTokens({ access: 'b', refresh: 'r' });
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
