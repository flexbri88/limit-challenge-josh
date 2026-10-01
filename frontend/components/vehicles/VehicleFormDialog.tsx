'use client';

import { Box, FormControlLabel, MenuItem, Stack, Switch, TextField } from '@mui/material';
import { useState } from 'react';
import FormDialog from '@/components/FormDialog';
import { useNotify } from '@/components/NotificationsProvider';
import { useOfficeOptions } from '@/hooks/use-offices';
import { useDuplicateCheck, useSaveVehicle } from '@/hooks/use-vehicles';
import { getErrorMessage, getFieldErrors, type FieldErrors } from '@/lib/errors';
import type { Vehicle, VehicleInput } from '@/lib/types';

interface VehicleFormDialogProps {
  open: boolean;
  /** Vehicle to edit; omit to create a new one. */
  vehicle?: Vehicle;
  onClose: () => void;
  onSaved?: (vehicle: Vehicle) => void;
}

interface FormValues {
  vin: string;
  license_plate: string;
  make: string;
  model: string;
  year: string;
  office: string;
  is_active: boolean;
}

function initialValues(vehicle?: Vehicle): FormValues {
  return {
    vin: vehicle?.vin ?? '',
    license_plate: vehicle?.license_plate ?? '',
    make: vehicle?.make ?? '',
    model: vehicle?.model ?? '',
    year: vehicle ? String(vehicle.year) : String(new Date().getFullYear()),
    office: vehicle ? String(vehicle.office) : '',
    is_active: vehicle?.is_active ?? true,
  };
}

function toInput(values: FormValues): VehicleInput {
  return {
    vin: values.vin.trim(),
    license_plate: values.license_plate.trim(),
    make: values.make.trim(),
    model: values.model.trim(),
    year: Number(values.year),
    office: Number(values.office),
    is_active: values.is_active,
  };
}

export function changedFields(before: VehicleInput, after: VehicleInput): Partial<VehicleInput> {
  return Object.fromEntries(
    Object.entries(after).filter(([field, value]) => before[field as keyof VehicleInput] !== value),
  );
}

/** Mount with a `key` per vehicle so the form starts from that vehicle's values. */
export default function VehicleFormDialog({
  open,
  vehicle,
  onClose,
  onSaved,
}: VehicleFormDialogProps) {
  const notify = useNotify();
  const offices = useOfficeOptions();
  const save = useSaveVehicle();
  const [values, setValues] = useState(() => initialValues(vehicle));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  // Identifiers are checked for duplicates when their field loses focus.
  const [checked, setChecked] = useState({ vin: '', license_plate: '' });
  const duplicates = useDuplicateCheck({
    ...checked,
    exclude: vehicle?.id,
    is_active: values.is_active,
  });
  const conflicts = duplicates.data?.conflicts ?? [];
  const duplicateWarning = (field: 'vin' | 'license_plate') =>
    // Only while the field still holds the value that was checked.
    conflicts.includes(field) && values[field].trim() === checked[field] ? (
      <Box component="span" sx={{ color: 'warning.dark' }}>
        {field === 'vin'
          ? 'Another vehicle already has this VIN.'
          : 'An active vehicle already has this plate.'}
      </Box>
    ) : undefined;
  const checkOnBlur = (field: 'vin' | 'license_plate') => () =>
    setChecked((current) => ({ ...current, [field]: values[field].trim() }));

  const update = <K extends keyof FormValues>(field: K, value: FormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    // The user is addressing this field; drop its stale server error.
    setErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = () => {
    setFormError(null);
    if (!values.office) {
      setErrors((current) => ({ ...current, office: 'Select an office.' }));
      return;
    }
    const input = toInput(values);
    // When editing, send only what changed so a concurrent change to another
    // field (e.g. an office move from the detail page) is not reverted.
    const changes = vehicle ? changedFields(toInput(initialValues(vehicle)), input) : input;
    if (vehicle && Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    save.mutate(
      { id: vehicle?.id, input: changes },
      {
        onSuccess: (saved) => {
          notify(`Vehicle ${saved.license_plate} ${vehicle ? 'updated' : 'created'}.`);
          onSaved?.(saved);
          onClose();
        },
        onError: (error) => {
          const fieldErrors = getFieldErrors(error);
          setErrors(fieldErrors);
          // Anything not shown next to an input goes to the form-level alert.
          if (!Object.keys(fieldErrors).every((field) => field in values)) {
            setFormError(getErrorMessage(error));
          }
        },
      },
    );
  };

  const fieldProps = (field: keyof FormValues) => ({
    error: Boolean(errors[field]),
    helperText: errors[field],
  });

  return (
    <FormDialog
      open={open}
      title={vehicle ? `Edit ${vehicle.license_plate}` : 'Add vehicle'}
      submitLabel={vehicle ? 'Save changes' : 'Add vehicle'}
      pending={save.isPending}
      error={formError}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <TextField
        label="VIN"
        required
        autoFocus={!vehicle}
        value={values.vin}
        onChange={(event) => update('vin', event.target.value.toUpperCase())}
        onBlur={checkOnBlur('vin')}
        slotProps={{ htmlInput: { maxLength: 17, spellCheck: false } }}
        {...fieldProps('vin')}
        helperText={
          errors.vin ?? duplicateWarning('vin') ?? '17 characters; letters I, O and Q are not used.'
        }
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="License plate"
          required
          fullWidth
          value={values.license_plate}
          onChange={(event) => update('license_plate', event.target.value.toUpperCase())}
          onBlur={checkOnBlur('license_plate')}
          slotProps={{ htmlInput: { maxLength: 15, spellCheck: false } }}
          {...fieldProps('license_plate')}
          helperText={errors.license_plate ?? duplicateWarning('license_plate')}
        />
        <TextField
          label="Year"
          required
          type="number"
          value={values.year}
          onChange={(event) => update('year', event.target.value)}
          slotProps={{ htmlInput: { min: 1980, max: new Date().getFullYear() + 1 } }}
          sx={{ width: { sm: 140 } }}
          {...fieldProps('year')}
        />
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Make"
          required
          fullWidth
          value={values.make}
          onChange={(event) => update('make', event.target.value)}
          {...fieldProps('make')}
        />
        <TextField
          label="Model"
          required
          fullWidth
          value={values.model}
          onChange={(event) => update('model', event.target.value)}
          {...fieldProps('model')}
        />
      </Stack>
      <TextField
        select
        label="Office"
        required
        value={values.office}
        onChange={(event) => update('office', event.target.value)}
        disabled={offices.isPending}
        {...fieldProps('office')}
        helperText={errors.office ?? (offices.isError ? 'Could not load offices.' : undefined)}
      >
        {(offices.data ?? []).map((office) => (
          <MenuItem key={office.id} value={String(office.id)}>
            {office.name} · {office.city}
          </MenuItem>
        ))}
      </TextField>
      <FormControlLabel
        control={
          <Switch
            checked={values.is_active}
            onChange={(event) => update('is_active', event.target.checked)}
          />
        }
        label={values.is_active ? 'Active — in service' : 'Inactive — retired from service'}
      />
    </FormDialog>
  );
}
