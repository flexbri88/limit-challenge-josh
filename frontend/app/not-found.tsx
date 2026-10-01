'use client';

import SearchOffIcon from '@mui/icons-material/SearchOff';
import { Button, Paper } from '@mui/material';
import Link from 'next/link';
import { EmptyState } from '@/components/QueryStates';

export default function NotFound() {
  return (
    <Paper>
      <EmptyState
        icon={<SearchOffIcon />}
        title="Page not found"
        description="The address may be mistyped, or the page has moved."
        action={
          <Button component={Link} href="/" variant="contained">
            Go to the dashboard
          </Button>
        }
      />
    </Paper>
  );
}
