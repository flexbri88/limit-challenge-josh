'use client';

import SearchIcon from '@mui/icons-material/Search';
import TuneIcon from '@mui/icons-material/Tune';
import {
  Badge,
  Box,
  Button,
  Chip,
  Collapse,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { useState } from 'react';
import DebouncedTextField from '@/components/DebouncedTextField';
import { formatDate } from '@/lib/format';
import type { FieldErrors } from '@/lib/errors';
import type { Office } from '@/lib/types';

export const VEHICLE_FILTER_KEYS = [
  'search',
  'office',
  'is_active',
  'make',
  'model',
  'maintained_from',
  'maintained_to',
  'mechanic_certification',
] as const;

export type VehicleFilterKey = (typeof VEHICLE_FILTER_KEYS)[number];
export type VehicleFilterValues = Record<VehicleFilterKey, string>;

const ADVANCED_KEYS: VehicleFilterKey[] = [
  'maintained_from',
  'maintained_to',
  'mechanic_certification',
];

const STATUS_LABELS: Record<string, string> = { true: 'Active', false: 'Inactive' };

// Show the "All …" option instead of an empty box when no value is selected.
const SELECT_SHOWING_EMPTY_OPTION = {
  inputLabel: { shrink: true },
  select: { displayEmpty: true },
};

interface VehicleFiltersProps {
  values: VehicleFilterValues;
  offices: Office[];
  errors: FieldErrors;
  onChange: (updates: Partial<VehicleFilterValues>) => void;
  onClear: () => void;
}

export default function VehicleFilters({
  values,
  offices,
  errors,
  onChange,
  onClear,
}: VehicleFiltersProps) {
  const advancedCount = ADVANCED_KEYS.filter((key) => values[key]).length;
  const [showAdvanced, setShowAdvanced] = useState(advancedCount > 0);
  const chips = activeFilterChips(values, offices);

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
        <DebouncedTextField
          label="Search"
          placeholder="Plate, VIN, make or model"
          value={values.search}
          onDebouncedChange={(search) => onChange({ search })}
          sx={{ flex: 2, minWidth: 200 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField
          select
          label="Office"
          value={values.office}
          onChange={(event) => onChange({ office: event.target.value })}
          error={Boolean(errors.office)}
          helperText={errors.office}
          sx={{ flex: 1, minWidth: 160 }}
          slotProps={SELECT_SHOWING_EMPTY_OPTION}
        >
          <MenuItem value="">All offices</MenuItem>
          {offices.map((office) => (
            <MenuItem key={office.id} value={String(office.id)}>
              {office.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Status"
          value={values.is_active}
          onChange={(event) => onChange({ is_active: event.target.value })}
          sx={{ flex: 1, minWidth: 130 }}
          slotProps={SELECT_SHOWING_EMPTY_OPTION}
        >
          <MenuItem value="">Any status</MenuItem>
          <MenuItem value="true">Active</MenuItem>
          <MenuItem value="false">Inactive</MenuItem>
        </TextField>
        <DebouncedTextField
          label="Make"
          value={values.make}
          onDebouncedChange={(make) => onChange({ make })}
          sx={{ flex: 1, minWidth: 120 }}
        />
        <DebouncedTextField
          label="Model"
          value={values.model}
          onDebouncedChange={(model) => onChange({ model })}
          sx={{ flex: 1, minWidth: 120 }}
        />
        <Box sx={{ flexShrink: 0 }}>
          <Badge badgeContent={advancedCount} color="primary">
            <Button
              variant="outlined"
              startIcon={<TuneIcon />}
              onClick={() => setShowAdvanced((open) => !open)}
              aria-expanded={showAdvanced}
              sx={{ height: 40 }}
            >
              Maintenance
            </Button>
          </Badge>
        </Box>
      </Stack>

      <Collapse in={showAdvanced} unmountOnExit>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            type="date"
            label="Maintained from"
            value={values.maintained_from}
            onChange={(event) => onChange({ maintained_from: event.target.value })}
            error={Boolean(errors.maintained_from)}
            helperText={errors.maintained_from}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            type="date"
            label="Maintained to"
            value={values.maintained_to}
            onChange={(event) => onChange({ maintained_to: event.target.value })}
            error={Boolean(errors.maintained_to)}
            helperText={errors.maintained_to}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <DebouncedTextField
            label="Mechanic certification #"
            placeholder="e.g. ASE-123456"
            value={values.mechanic_certification}
            onDebouncedChange={(mechanic_certification) => onChange({ mechanic_certification })}
            helperText="Serviced by this mechanic (within the dates, if set)"
            sx={{ minWidth: 240 }}
          />
        </Stack>
      </Collapse>

      {chips.length > 0 && (
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{ flexWrap: 'wrap', alignItems: 'center' }}
        >
          {chips.map((chip) => (
            <Chip
              key={chip.key}
              label={chip.label}
              size="small"
              onDelete={() => onChange({ [chip.key]: '' })}
            />
          ))}
          <Button size="small" onClick={onClear}>
            Clear all
          </Button>
        </Stack>
      )}
    </Stack>
  );
}

function activeFilterChips(values: VehicleFilterValues, offices: Office[]) {
  const describe: Record<VehicleFilterKey, (value: string) => string> = {
    search: (v) => `Search: “${v}”`,
    office: (v) => `Office: ${offices.find((o) => String(o.id) === v)?.name ?? `#${v}`}`,
    is_active: (v) => STATUS_LABELS[v] ?? `Status: ${v}`,
    make: (v) => `Make: ${v}`,
    model: (v) => `Model: ${v}`,
    maintained_from: (v) => `Maintained from ${formatDate(v)}`,
    maintained_to: (v) => `Maintained to ${formatDate(v)}`,
    mechanic_certification: (v) => `Mechanic: ${v}`,
  };
  return VEHICLE_FILTER_KEYS.filter((key) => values[key]).map((key) => ({
    key,
    label: describe[key](values[key]),
  }));
}
