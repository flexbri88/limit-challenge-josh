'use client';

import { Autocomplete, Box, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useVehicleSearch } from '@/hooks/use-vehicles';

export interface VehicleOption {
  id: number;
  license_plate: string;
  description?: string;
}

interface VehiclePickerProps {
  value: VehicleOption | null;
  onChange: (vehicle: VehicleOption | null) => void;
  error?: string;
  disabled?: boolean;
}

/** Searches vehicles server-side as the user types (plate, VIN, make or model). */
export default function VehiclePicker({ value, onChange, error, disabled }: VehiclePickerProps) {
  const [input, setInput] = useState('');
  const search = useDebouncedValue(input.trim(), 300);
  const vehicles = useVehicleSearch({ search, page_size: 20, ordering: 'license_plate' });

  // Never offer results for an older query: a fast typist could pick the wrong vehicle.
  const settled = search === input.trim() && !vehicles.isPlaceholderData;
  const results = settled ? (vehicles.data?.results ?? []) : [];
  const options: VehicleOption[] = results.map((vehicle) => ({
    id: vehicle.id,
    license_plate: vehicle.license_plate,
    description: `${vehicle.year} ${vehicle.make} ${vehicle.model} · ${vehicle.office_name}${vehicle.is_active ? '' : ' · inactive'}`,
  }));

  return (
    <Autocomplete
      value={value}
      onChange={(_, next) => onChange(next)}
      inputValue={input}
      onInputChange={(_, next) => setInput(next)}
      options={options}
      // Results are already filtered by the API.
      filterOptions={(all) => all}
      getOptionLabel={(option) => option.license_plate}
      isOptionEqualToValue={(option, selected) => option.id === selected.id}
      loading={!settled || vehicles.isFetching}
      loadingText="Searching…"
      disabled={disabled}
      noOptionsText={search ? 'No matching vehicles' : 'Type to search vehicles'}
      renderOption={({ key, ...props }, option) => (
        <Box component="li" key={key} {...props}>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {option.license_plate}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {option.description}
            </Typography>
          </Box>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Vehicle"
          required
          placeholder="Search by plate, VIN, make or model"
          error={Boolean(error)}
          helperText={error}
        />
      )}
    />
  );
}
