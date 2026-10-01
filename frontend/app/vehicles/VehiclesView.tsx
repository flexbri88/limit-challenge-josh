'use client';

import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Box,
  Button,
  IconButton,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Tooltip,
  Typography,
} from '@mui/material';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import PageHeader from '@/components/PageHeader';
import {
  EmptyState,
  ListErrorState,
  TableMessageRow,
  TableSkeletonRows,
} from '@/components/QueryStates';
import StatusChip from '@/components/StatusChip';
import DeleteVehicleDialog from '@/components/vehicles/DeleteVehicleDialog';
import VehicleFormDialog from '@/components/vehicles/VehicleFormDialog';
import { useOfficeOptions } from '@/hooks/use-offices';
import {
  pageAfterDelete,
  paginationProps,
  readPagination,
  useSearchParamsState,
} from '@/hooks/use-search-params-state';
import { useVehicleSearch } from '@/hooks/use-vehicles';
import { getFieldErrors } from '@/lib/errors';
import type { Vehicle } from '@/lib/types';
import VehicleFilters, { VEHICLE_FILTER_KEYS, type VehicleFilterValues } from './VehicleFilters';

const COLUMNS = 7;

const SORTABLE_COLUMNS = [
  { field: 'license_plate', label: 'License plate' },
  { field: 'make', label: 'Vehicle' },
  { field: 'year', label: 'Year' },
] as const;

export default function VehiclesView() {
  const router = useRouter();
  const [searchParams, setParams] = useSearchParamsState();
  // `null` = closed, `undefined` vehicle = create mode.
  const [editing, setEditing] = useState<{ vehicle?: Vehicle } | null>(null);
  const [deleting, setDeleting] = useState<Vehicle | null>(null);

  const filters = Object.fromEntries(
    VEHICLE_FILTER_KEYS.map((key) => [key, searchParams.get(key) ?? '']),
  ) as VehicleFilterValues;
  const { page, pageSize } = readPagination(searchParams);
  const ordering = searchParams.get('ordering') ?? '';

  const offices = useOfficeOptions();
  const vehicles = useVehicleSearch({ ...filters, ordering, page, page_size: pageSize });
  const hasFilters = VEHICLE_FILTER_KEYS.some((key) => filters[key]);
  const clearFilters = () =>
    setParams(Object.fromEntries(VEHICLE_FILTER_KEYS.map((key) => [key, null])));

  const toggleSort = (field: string) => {
    const next = ordering === field ? `-${field}` : ordering === `-${field}` ? '' : field;
    setParams({ ordering: next });
  };

  const rows = vehicles.data?.results ?? [];

  return (
    <>
      <PageHeader
        title="Vehicles"
        subtitle={
          vehicles.data
            ? describeCount(vehicles.data.count, hasFilters)
            : 'Search the fleet by office, status, make, model or maintenance history.'
        }
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing({})}>
            Add vehicle
          </Button>
        }
      />

      <Paper sx={{ p: 2, mb: 2 }}>
        <VehicleFilters
          values={filters}
          offices={offices.data ?? []}
          errors={getFieldErrors(vehicles.error)}
          onChange={setParams}
          onClear={clearFilters}
        />
      </Paper>

      <Paper sx={{ overflow: 'hidden' }}>
        <Box sx={{ height: 4 }}>
          {vehicles.isFetching && !vehicles.isPending && <LinearProgress />}
        </Box>
        <TableContainer>
          <Table size="medium" aria-label="Vehicles">
            <TableHead>
              <TableRow>
                {SORTABLE_COLUMNS.map(({ field, label }) => (
                  <TableCell
                    key={field}
                    sortDirection={
                      ordering.replace('-', '') === field
                        ? ordering.startsWith('-')
                          ? 'desc'
                          : 'asc'
                        : false
                    }
                  >
                    <TableSortLabel
                      active={ordering.replace('-', '') === field}
                      direction={ordering === `-${field}` ? 'desc' : 'asc'}
                      onClick={() => toggleSort(field)}
                    >
                      {label}
                    </TableSortLabel>
                  </TableCell>
                ))}
                <TableCell>VIN</TableCell>
                <TableCell>Office</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right" aria-label="Actions" />
              </TableRow>
            </TableHead>
            <TableBody>
              {vehicles.isPending && (
                <TableSkeletonRows columns={COLUMNS} rows={pageSize > 10 ? 10 : pageSize} />
              )}

              {vehicles.isError && (
                <TableMessageRow columns={COLUMNS}>
                  <ListErrorState
                    error={vehicles.error}
                    page={page}
                    onFirstPage={() => setParams({ page: null })}
                    onRetry={() => vehicles.refetch()}
                  />
                </TableMessageRow>
              )}

              {vehicles.isSuccess && rows.length === 0 && (
                <TableMessageRow columns={COLUMNS}>
                  {hasFilters ? (
                    <EmptyState
                      title="No vehicles match these filters"
                      description="Try removing a filter or widening the maintenance date range."
                      action={<Button onClick={clearFilters}>Clear filters</Button>}
                    />
                  ) : (
                    <EmptyState
                      title="No vehicles yet"
                      description="Add your first vehicle to start tracking its maintenance."
                      action={
                        <Button startIcon={<AddIcon />} onClick={() => setEditing({})}>
                          Add vehicle
                        </Button>
                      }
                    />
                  )}
                </TableMessageRow>
              )}

              {!vehicles.isError &&
                rows.map((vehicle) => (
                  <TableRow
                    key={vehicle.id}
                    hover
                    onClick={() => router.push(`/vehicles/${vehicle.id}`)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ fontWeight: 600 }}>{vehicle.license_plate}</TableCell>
                    <TableCell>
                      {vehicle.make} {vehicle.model}
                    </TableCell>
                    <TableCell>{vehicle.year}</TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: 'var(--font-geist-mono), monospace' }}
                      >
                        {vehicle.vin}
                      </Typography>
                    </TableCell>
                    <TableCell>{vehicle.office_name}</TableCell>
                    <TableCell>
                      <StatusChip active={vehicle.is_active} />
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ whiteSpace: 'nowrap' }}
                      // Row clicks open the detail page; actions must not.
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          aria-label={`Edit ${vehicle.license_plate}`}
                          onClick={() => setEditing({ vehicle })}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          aria-label={`Delete ${vehicle.license_plate}`}
                          onClick={() => setDeleting(vehicle)}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          {...paginationProps(vehicles.data?.count, { page, pageSize }, setParams)}
        />
      </Paper>

      {editing && (
        <VehicleFormDialog
          key={editing.vehicle?.id ?? 'new'}
          open
          vehicle={editing.vehicle}
          onClose={() => setEditing(null)}
        />
      )}
      <DeleteVehicleDialog
        vehicle={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => setParams({ page: pageAfterDelete(rows.length, page) })}
      />
    </>
  );
}

function describeCount(count: number, filtered: boolean) {
  const vehicles = `${count.toLocaleString()} vehicle${count === 1 ? '' : 's'}`;
  if (!filtered) return vehicles;
  return `${vehicles} ${count === 1 ? 'matches' : 'match'} your filters`;
}
