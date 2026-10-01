'use client';

import { LinearProgress } from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import { queryKeys } from '@/hooks/query-keys';
import { authApi } from '@/lib/api';
import { getTokens, loginPath, setTokens, subscribeToTokens } from '@/lib/auth';
import type { CurrentUser } from '@/lib/types';

/** `unknown` until the browser has read the stored session (always so on the server). */
type AuthStatus = 'unknown' | 'signed-in' | 'signed-out';

interface AuthContextValue {
  status: AuthStatus;
  user: CurrentUser | undefined;
  /** True after "Sign out", as opposed to an expired session or a signed-out visit. */
  signedOutByUser: boolean;
  login: (credentials: { username: string; password: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const tokens = useSyncExternalStore(subscribeToTokens, getTokens, () => undefined);
  const status: AuthStatus = tokens === undefined ? 'unknown' : tokens ? 'signed-in' : 'signed-out';
  const queryClient = useQueryClient();
  const [signedOutByUser, setSignedOutByUser] = useState(false);
  const user = useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: authApi.me,
    enabled: status === 'signed-in',
    staleTime: Infinity,
  });

  // However the session ended (sign-out here or in another tab, or expiry), drop
  // everything cached so the next user never sees the previous one's data.
  useEffect(() => {
    if (status === 'signed-out') queryClient.clear();
  }, [status, queryClient]);

  const login = useCallback<AuthContextValue['login']>(async (credentials) => {
    setTokens(await authApi.login(credentials));
    setSignedOutByUser(false);
  }, []);

  const logout = useCallback(() => {
    const current = getTokens();
    setSignedOutByUser(true);
    setTokens(null);
    // Best effort: if revoking fails, the refresh token still expires on its own.
    if (current) authApi.logout(current.refresh).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ status, user: user.data, signedOutByUser, login, logout }),
    [status, user.data, signedOutByUser, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

/** Renders the page only for a signed-in user; anyone else goes to the login page. */
export function AuthGate({ children }: PropsWithChildren) {
  const { status, signedOutByUser } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const onLoginPage = pathname === '/login';

  useEffect(() => {
    if (status === 'signed-out' && !onLoginPage) {
      // Come back here after signing in, unless the user chose to leave.
      const here = window.location.pathname + window.location.search;
      router.replace(signedOutByUser ? '/login' : loginPath(here));
    }
  }, [status, signedOutByUser, onLoginPage, router]);

  if (onLoginPage) return children;
  if (status !== 'signed-in') return <LinearProgress aria-label="Checking your session" />;
  return children;
}
