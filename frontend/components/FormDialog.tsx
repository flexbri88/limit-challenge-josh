'use client';

import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
} from '@mui/material';
import type { FormEvent, ReactNode } from 'react';

interface FormDialogProps {
  open: boolean;
  title: string;
  submitLabel?: string;
  pending?: boolean;
  /** Form-level error (field errors are shown on their inputs). */
  error?: string | null;
  onSubmit: () => void;
  onClose: () => void;
  children: ReactNode;
}

export default function FormDialog({
  open,
  title,
  submitLabel = 'Save',
  pending = false,
  error,
  onSubmit,
  onClose,
  children,
}: FormDialogProps) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {children}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" loading={pending}>
            {submitLabel}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
