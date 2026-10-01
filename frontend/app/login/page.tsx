import { LinearProgress } from '@mui/material';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import LoginView from './LoginView';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage() {
  // Rendered per request: where to go after signing in comes from the query string.
  await connection();
  return (
    <Suspense fallback={<LinearProgress />}>
      <LoginView />
    </Suspense>
  );
}
