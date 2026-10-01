'use client';

import { FormControlLabel, Switch, TextField } from '@mui/material';
import { useState } from 'react';
import FormDialog from '@/components/FormDialog';
import { useNotify } from '@/components/NotificationsProvider';
import { useSaveMechanic } from '@/hooks/use-mechanics';
import { getErrorMessage, getFieldErrors } from '@/lib/errors';
import type { Mechanic } from '@/lib/types';

interface MechanicFormDialogProps {
  mechanic?: Mechanic;
  onClose: () => void;
}

/** Mount with a `key` per mechanic so the form starts from that mechanic's values. */
export default function MechanicFormDialog({ mechanic, onClose }: MechanicFormDialogProps) {
  const notify = useNotify();
  const save = useSaveMechanic();
  const [name, setName] = useState(mechanic?.name ?? '');
  const [certification, setCertification] = useState(mechanic?.certification_number ?? '');
  const [isActive, setIsActive] = useState(mechanic?.is_active ?? true);

  const errors = getFieldErrors(save.error);
  const formError =
    save.error && Object.keys(errors).length === 0 ? getErrorMessage(save.error) : null;

  const handleSubmit = () =>
    save.mutate(
      {
        id: mechanic?.id,
        input: {
          name: name.trim(),
          certification_number: certification.trim(),
          is_active: isActive,
        },
      },
      {
        onSuccess: (saved) => {
          notify(`Mechanic ${saved.name} ${mechanic ? 'updated' : 'created'}.`);
          onClose();
        },
      },
    );

  return (
    <FormDialog
      open
      title={mechanic ? `Edit ${mechanic.name}` : 'Add mechanic'}
      submitLabel={mechanic ? 'Save changes' : 'Add mechanic'}
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
        label="Certification number"
        required
        value={certification}
        onChange={(event) => setCertification(event.target.value.toUpperCase())}
        error={Boolean(errors.certification_number)}
        helperText={errors.certification_number ?? 'Must be unique, e.g. ASE-123456.'}
      />
      <FormControlLabel
        control={
          <Switch checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
        }
        label={isActive ? 'Active — can be assigned new work' : 'Inactive — history is kept'}
      />
    </FormDialog>
  );
}
