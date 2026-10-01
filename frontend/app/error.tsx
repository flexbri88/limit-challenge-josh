'use client';

import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Button, Paper, Stack } from '@mui/material';
import Link from 'next/link';
import { useEffect } from 'react';
import { EmptyState } from '@/components/QueryStates';

/** Last-resort boundary for unexpected render errors; data errors are handled in place. */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Paper>
      <EmptyState
        icon={<ErrorOutlineIcon />}
        title="Something went wrong on this page"
        description="An unexpected error occurred. Try again, or go back to the dashboard."
        action={
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={() => unstable_retry()}>
              Try again
            </Button>
            <Button component={Link} href="/">
              Dashboard
            </Button>
          </Stack>
        }
      />
    </Paper>
  );
}
