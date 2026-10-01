'use client';

import { TextField } from '@mui/material';
import { useState } from 'react';
import FormDialog from '@/components/FormDialog';
import { useNotify } from '@/components/NotificationsProvider';
import { useSaveOffice } from '@/hooks/use-offices';
import { getErrorMessage, getFieldErrors } from '@/lib/errors';
import type { Office } from '@/lib/types';

interface OfficeFormDialogProps {
  office?: Office;
  onClose: () => void;
}

/** Mount with a `key` per office so the form starts from that office's values. */
export default function OfficeFormDialog({ office, onClose }: OfficeFormDialogProps) {
  const notify = useNotify();
  const save = useSaveOffice();
  const [name, setName] = useState(office?.name ?? '');
  const [city, setCity] = useState(office?.city ?? '');

  const errors = getFieldErrors(save.error);
  const formError =
    save.error && Object.keys(errors).length === 0 ? getErrorMessage(save.error) : null;

  const handleSubmit = () =>
    save.mutate(
      { id: office?.id, input: { name: name.trim(), city: city.trim() } },
      {
        onSuccess: (saved) => {
          notify(`Office ${saved.name} ${office ? 'updated' : 'created'}.`);
          onClose();
        },
      },
    );

  return (
    <FormDialog
      open
      title={office ? `Edit ${office.name}` : 'Add office'}
      submitLabel={office ? 'Save changes' : 'Add office'}
      pending={save.isPending}
      error={formError}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <TextField
        label="Name"
        required
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={Boolean(errors.name)}
        helperText={errors.name}
      />
      <TextField
        label="City"
        required
        value={city}
        onChange={(event) => setCity(event.target.value)}
        error={Boolean(errors.city)}
        helperText={errors.city}
      />
    </FormDialog>
  );
}
