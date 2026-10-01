'use client';

import { MenuItem, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import FormDialog from '@/components/FormDialog';
import { useNotify } from '@/components/NotificationsProvider';
import { useOfficeOptions } from '@/hooks/use-offices';
import { useAssignVehicle } from '@/hooks/use-vehicles';
import { getErrorMessage, getFieldErrors } from '@/lib/errors';
import type { Vehicle } from '@/lib/types';

interface AssignOfficeDialogProps {
  open: boolean;
  vehicle: Vehicle;
  onClose: () => void;
}

export default function AssignOfficeDialog({ open, vehicle, onClose }: AssignOfficeDialogProps) {
  const notify = useNotify();
  const offices = useOfficeOptions();
  const assign = useAssignVehicle();
  const [office, setOffice] = useState('');
  const [missing, setMissing] = useState(false);

  const otherOffices = (offices.data ?? []).filter((candidate) => candidate.id !== vehicle.office);
  const noOtherOffice = offices.isSuccess && otherOffices.length === 0;
  const fieldError =
    getFieldErrors(assign.error).office ?? (missing ? 'Select an office.' : undefined);
  const formError = assign.error && !fieldError ? getErrorMessage(assign.error) : null;

  const handleSubmit = () => {
    if (!office) {
      setMissing(true);
      return;
    }
    assign.mutate(
      { id: vehicle.id, office: Number(office) },
      {
        onSuccess: (updated) => {
          notify(`${updated.license_plate} moved to ${updated.office_name}.`);
          onClose();
        },
      },
    );
  };

  return (
    <FormDialog
      open={open}
      title={`Move ${vehicle.license_plate} to another office`}
      submitLabel="Move vehicle"
      pending={assign.isPending}
      error={formError}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <Typography variant="body2" color="text.secondary">
        Currently assigned to <strong>{vehicle.office_name}</strong>. Only the office assignment
        changes; the vehicle&apos;s details and maintenance history stay as they are.
      </Typography>
      <TextField
        select
        label="New office"
        required
        autoFocus
        value={office}
        onChange={(event) => {
          setOffice(event.target.value);
          setMissing(false);
        }}
        disabled={offices.isPending || noOtherOffice}
        error={Boolean(fieldError) || offices.isError}
        helperText={
          fieldError ??
          (offices.isError
            ? 'Could not load offices. Close and try again.'
            : noOtherOffice
              ? 'There is no other office to move to. Create one first.'
              : undefined)
        }
      >
        {otherOffices.map((candidate) => (
          <MenuItem key={candidate.id} value={String(candidate.id)}>
            {candidate.name} · {candidate.city}
          </MenuItem>
        ))}
      </TextField>
    </FormDialog>
  );
}
