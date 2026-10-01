'use client';

import { InputAdornment, MenuItem, Stack, TextField } from '@mui/material';
import { useState } from 'react';
import FormDialog from '@/components/FormDialog';
import { useNotify } from '@/components/NotificationsProvider';
import { useSaveMaintenanceRecord } from '@/hooks/use-maintenance-records';
import { useActiveMechanicOptions } from '@/hooks/use-mechanics';
import { getErrorMessage, getFieldErrors, type FieldErrors } from '@/lib/errors';
import { todayIso } from '@/lib/format';
import { MAINTENANCE_TYPES, type MaintenanceRecord, type MaintenanceType } from '@/lib/types';
import VehiclePicker, { type VehicleOption } from './VehiclePicker';

interface MaintenanceRecordFormDialogProps {
  /** Record to edit; omit to log a new one. */
  record?: MaintenanceRecord;
  /** Pre-selected, fixed vehicle (e.g. when logging from a vehicle's page). */
  vehicle?: VehicleOption;
  onClose: () => void;
}

interface FormValues {
  vehicle: VehicleOption | null;
  mechanic: string;
  date: string;
  maintenance_type: MaintenanceType | '';
  cost: string;
  notes: string;
}

function initialValues(record?: MaintenanceRecord, vehicle?: VehicleOption): FormValues {
  return {
    vehicle: record
      ? { id: record.vehicle, license_plate: record.vehicle_license_plate }
      : (vehicle ?? null),
    mechanic: record ? String(record.mechanic) : '',
    date: record?.date ?? todayIso(),
    maintenance_type: record?.maintenance_type ?? '',
    cost: record ? String(record.cost) : '',
    notes: record?.notes ?? '',
  };
}

/** Mount with a `key` per record so the form starts from that record's values. */
export default function MaintenanceRecordFormDialog({
  record,
  vehicle,
  onClose,
}: MaintenanceRecordFormDialogProps) {
  const notify = useNotify();
  const mechanics = useActiveMechanicOptions();
  const save = useSaveMaintenanceRecord();
  const [values, setValues] = useState(() => initialValues(record, vehicle));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  // A record keeps its original mechanic even if they have since left.
  const mechanicOptions = [...(mechanics.data ?? [])];
  if (record && !mechanicOptions.some((mechanic) => mechanic.id === record.mechanic)) {
    mechanicOptions.push({
      id: record.mechanic,
      name: `${record.mechanic_name} (inactive)`,
      certification_number: '',
      is_active: false,
    });
  }

  const update = <K extends keyof FormValues>(field: K, value: FormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!(field in current)) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = () => {
    const missing: FieldErrors = {};
    if (!values.vehicle) missing.vehicle = 'Select a vehicle.';
    if (!values.mechanic) missing.mechanic = 'Select a mechanic.';
    if (!values.maintenance_type) missing.maintenance_type = 'Select a type.';
    const selectedVehicle = values.vehicle;
    if (!selectedVehicle || Object.keys(missing).length > 0) {
      setErrors(missing);
      return;
    }
    setFormError(null);
    save.mutate(
      {
        id: record?.id,
        input: {
          vehicle: selectedVehicle.id,
          mechanic: Number(values.mechanic),
          date: values.date,
          maintenance_type: values.maintenance_type as MaintenanceType,
          cost: values.cost,
          notes: values.notes.trim(),
        },
      },
      {
        onSuccess: (saved) => {
          notify(
            `Maintenance for ${saved.vehicle_license_plate} ${record ? 'updated' : 'logged'}.`,
          );
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

  return (
    <FormDialog
      open
      title={record ? 'Edit maintenance record' : 'Log maintenance'}
      submitLabel={record ? 'Save changes' : 'Log maintenance'}
      pending={save.isPending}
      error={formError}
      onSubmit={handleSubmit}
      onClose={onClose}
    >
      <VehiclePicker
        value={values.vehicle}
        onChange={(next) => update('vehicle', next)}
        error={errors.vehicle}
        disabled={Boolean(vehicle) && !record}
      />
      <TextField
        select
        label="Mechanic"
        required
        value={values.mechanic}
        onChange={(event) => update('mechanic', event.target.value)}
        disabled={mechanics.isPending}
        error={Boolean(errors.mechanic)}
        helperText={
          errors.mechanic ?? (mechanics.isError ? 'Could not load mechanics.' : 'Active mechanics')
        }
      >
        {mechanicOptions.map((mechanic) => (
          <MenuItem key={mechanic.id} value={String(mechanic.id)}>
            {mechanic.name}
            {mechanic.certification_number && ` · ${mechanic.certification_number}`}
          </MenuItem>
        ))}
      </TextField>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          type="date"
          label="Date"
          required
          fullWidth
          value={values.date}
          onChange={(event) => update('date', event.target.value)}
          error={Boolean(errors.date)}
          helperText={errors.date}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: todayIso() } }}
        />
        <TextField
          select
          label="Type"
          required
          fullWidth
          value={values.maintenance_type}
          onChange={(event) => update('maintenance_type', event.target.value as MaintenanceType)}
          error={Boolean(errors.maintenance_type)}
          helperText={errors.maintenance_type}
        >
          {MAINTENANCE_TYPES.map((type) => (
            <MenuItem key={type.value} value={type.value}>
              {type.label}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          type="number"
          label="Cost"
          required
          fullWidth
          value={values.cost}
          onChange={(event) => update('cost', event.target.value)}
          error={Boolean(errors.cost)}
          helperText={errors.cost}
          slotProps={{
            input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
            htmlInput: { min: 0, step: '0.01' },
          }}
        />
      </Stack>
      <TextField
        label="Notes"
        multiline
        minRows={2}
        value={values.notes}
        onChange={(event) => update('notes', event.target.value)}
        error={Boolean(errors.notes)}
        helperText={errors.notes}
      />
    </FormDialog>
  );
}
