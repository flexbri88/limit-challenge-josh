import { LinearProgress } from '@mui/material';
import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import OfficesView from './OfficesView';

export const metadata: Metadata = { title: 'Offices' };

export default async function OfficesPage() {
  // Render per request: this page's state is in the query string, and a statically
  // prerendered page loaded with a query string (a shared filter link) could not
  // navigate on the client afterwards.
  await connection();
  return (
    <Suspense fallback={<LinearProgress />}>
      <OfficesView />
    </Suspense>
  );
}
