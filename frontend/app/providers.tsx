'use client';

import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { PropsWithChildren, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import AppShell from '@/components/AppShell';
import { AuthGate, AuthProvider } from '@/components/AuthProvider';
import { NotificationsProvider } from '@/components/NotificationsProvider';

function useTheme() {
  return useMemo(
    () =>
      createTheme({
        palette: {
          primary: {
            main: '#0f62fe',
          },
          background: {
            default: '#f5f7fb',
          },
        },
        shape: { borderRadius: 8 },
        typography: {
          fontFamily: 'var(--font-geist-sans), Roboto, Helvetica, Arial, sans-serif',
          button: { textTransform: 'none', fontWeight: 600 },
        },
        components: {
          MuiButton: { defaultProps: { disableElevation: true } },
          MuiPaper: { defaultProps: { variant: 'outlined' } },
          MuiTableCell: {
            styleOverrides: {
              head: { fontWeight: 600, color: '#5b6474', whiteSpace: 'nowrap' },
            },
          },
          MuiTextField: { defaultProps: { size: 'small' } },
        },
      }),
    [],
  );
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Client errors (400/404) will not fix themselves; retry only network/5xx once.
        retry: (failureCount, error) => {
          const status = isAxiosError(error) ? error.response?.status : undefined;
          return failureCount < 1 && (status === undefined || status >= 500);
        },
      },
    },
  });
}

export default function Providers({ children }: PropsWithChildren) {
  const theme = useTheme();
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <NotificationsProvider>
          <AuthProvider>
            <AppShell>
              <AuthGate>{children}</AuthGate>
            </AppShell>
          </AuthProvider>
        </NotificationsProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
