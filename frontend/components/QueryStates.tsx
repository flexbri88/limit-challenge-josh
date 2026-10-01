import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import {
  Alert,
  Box,
  Button,
  Skeleton,
  Stack,
  TableCell,
  TableRow,
  Typography,
} from '@mui/material';
import type { ReactNode } from 'react';
import { getErrorMessage, isNotFound } from '@/lib/errors';

/** Placeholder rows shown while a table's first page loads. */
export function TableSkeletonRows({ rows = 5, columns }: { rows?: number; columns: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <TableRow key={row}>
          {Array.from({ length: columns }, (_, column) => (
            <TableCell key={column}>
              <Skeleton variant="text" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Alert
      severity="error"
      action={
        onRetry && (
          <Button color="inherit" size="small" onClick={onRetry}>
            Retry
          </Button>
        )
      }
    >
      {getErrorMessage(error, 'Could not load data.')}
    </Alert>
  );
}

interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <Stack spacing={1} sx={{ alignItems: 'center', textAlign: 'center', py: 6, px: 2 }}>
      <Box sx={{ color: 'text.disabled', '& svg': { fontSize: 48 } }}>
        {icon ?? <InboxOutlinedIcon />}
      </Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ pt: 1 }}>{action}</Box>}
    </Stack>
  );
}

/** Full-width table row wrapping an empty or error state. */
export function TableMessageRow({ columns, children }: { columns: number; children: ReactNode }) {
  return (
    <TableRow>
      <TableCell colSpan={columns} sx={{ borderBottom: 0 }}>
        {children}
      </TableCell>
    </TableRow>
  );
}

interface ListErrorStateProps {
  error: unknown;
  page: number;
  onFirstPage: () => void;
  onRetry: () => void;
}

/**
 * Error for a paginated list. A page that no longer exists (the list shrank,
 * or an old link) gets a way back instead of a retry that can never succeed.
 */
export function ListErrorState({ error, page, onFirstPage, onRetry }: ListErrorStateProps) {
  if (isNotFound(error) && page > 1) {
    return (
      <EmptyState
        title="This page no longer exists"
        description="The list changed since this page was loaded."
        action={<Button onClick={onFirstPage}>Go to first page</Button>}
      />
    );
  }
  return <ErrorState error={error} onRetry={onRetry} />;
}
