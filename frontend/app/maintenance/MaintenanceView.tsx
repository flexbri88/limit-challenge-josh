'use client';

import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Box,
  Button,
  Chip,
  IconButton,
  LinearProgress,
  Link as MuiLink,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
} from '@mui/material';
import Link from 'next/link';
import { useState } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';
import MaintenanceRecordFormDialog from '@/components/maintenance/MaintenanceRecordFormDialog';
import { useNotify } from '@/components/NotificationsProvider';
import PageHeader from '@/components/PageHeader';
import {
  EmptyState,
  ListErrorState,
  TableMessageRow,
  TableSkeletonRows,
} from '@/components/QueryStates';
import { useDeleteMaintenanceRecord, useMaintenanceRecords } from '@/hooks/use-maintenance-records';
import {
  pageAfterDelete,
  paginationProps,
  readPagination,
  useSearchParamsState,
} from '@/hooks/use-search-params-state';
import { getErrorMessage } from '@/lib/errors';
import { formatCurrency, formatDate } from '@/lib/format';
import { MAINTENANCE_TYPES, type MaintenanceRecord } from '@/lib/types';

const COLUMNS = 7;
const TYPE_LABELS = Object.fromEntries(MAINTENANCE_TYPES.map((type) => [type.value, type.label]));

export default function MaintenanceView() {
  const notify = useNotify();
  const [searchParams, setParams] = useSearchParamsState();
  const pagination = readPagination(searchParams);
  const type = searchParams.get('maintenance_type') ?? '';
  const vehicle = searchParams.get('vehicle') ?? '';
  const ordering = searchParams.get('ordering') ?? '';

  const records = useMaintenanceRecords({
    maintenance_type: type,
    vehicle,
    ordering,
    page: pagination.page,
    page_size: pagination.pageSize,
  });
  const remove = useDeleteMaintenanceRecord();
  const [editing, setEditing] = useState<{ record?: MaintenanceRecord } | null>(null);
  const [deleting, setDeleting] = useState<MaintenanceRecord | null>(null);

  const rows = records.data?.results ?? [];
  const hasFilters = Boolean(type || vehicle);
  const vehicleLabel = rows[0]?.vehicle_license_plate ?? `#${vehicle}`;

  const toggleSort = (field: 'date' | 'cost') => {
    // Default order is newest first, so the first click on date sorts oldest first.
    const current = ordering || '-date';
    setParams({ ordering: current === `-${field}` ? field : `-${field}` });
  };
  const sortState = (field: 'date' | 'cost') => {
    const current = ordering || '-date';
    return {
      active: current.replace('-', '') === field,
      direction: current === `-${field}` ? ('desc' as const) : ('asc' as const),
    };
  };

  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        notify('Maintenance record deleted.');
        setParams({ page: pageAfterDelete(rows.length, pagination.page) });
      },
      onError: (error) => notify(getErrorMessage(error, 'Could not delete the record.'), 'error'),
      onSettled: () => setDeleting(null),
    });
  };

  return (
    <>
      <PageHeader
        title="Maintenance"
        subtitle="Every service performed on the fleet, newest first."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing({})}>
            Log maintenance
          </Button>
        }
      />

      <Stack
        direction="row"
        spacing={1.5}
        useFlexGap
        sx={{ mb: 2, flexWrap: 'wrap', alignItems: 'center' }}
      >
        <TextField
          select
          label="Type"
          value={type}
          onChange={(event) => setParams({ maintenance_type: event.target.value })}
          sx={{ minWidth: 200, bgcolor: 'background.paper' }}
          slotProps={{ inputLabel: { shrink: true }, select: { displayEmpty: true } }}
        >
          <MenuItem value="">All types</MenuItem>
          {MAINTENANCE_TYPES.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        {vehicle && (
          <Chip label={`Vehicle: ${vehicleLabel}`} onDelete={() => setParams({ vehicle: null })} />
        )}
      </Stack>

      <Paper sx={{ overflow: 'hidden' }}>
        <Box sx={{ height: 4 }}>
          {records.isFetching && !records.isPending && <LinearProgress />}
        </Box>
        <TableContainer>
          <Table aria-label="Maintenance records">
            <TableHead>
              <TableRow>
                <TableCell>
                  <TableSortLabel {...sortState('date')} onClick={() => toggleSort('date')}>
                    Date
                  </TableSortLabel>
                </TableCell>
                <TableCell>Vehicle</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Mechanic</TableCell>
                <TableCell align="right">
                  <TableSortLabel {...sortState('cost')} onClick={() => toggleSort('cost')}>
                    Cost
                  </TableSortLabel>
                </TableCell>
                <TableCell>Notes</TableCell>
                <TableCell align="right" aria-label="Actions" />
              </TableRow>
            </TableHead>
            <TableBody>
              {records.isPending && <TableSkeletonRows columns={COLUMNS} />}
              {records.isError && (
                <TableMessageRow columns={COLUMNS}>
                  <ListErrorState
                    error={records.error}
                    page={pagination.page}
                    onFirstPage={() => setParams({ page: null })}
                    onRetry={() => records.refetch()}
                  />
                </TableMessageRow>
              )}
              {records.isSuccess && rows.length === 0 && (
                <TableMessageRow columns={COLUMNS}>
                  {hasFilters ? (
                    <EmptyState
                      title="No records match these filters"
                      action={
                        <Button
                          onClick={() => setParams({ maintenance_type: null, vehicle: null })}
                        >
                          Clear filters
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      title="No maintenance logged yet"
                      action={
                        <Button startIcon={<AddIcon />} onClick={() => setEditing({})}>
                          Log maintenance
                        </Button>
                      }
                    />
                  )}
                </TableMessageRow>
              )}
              {!records.isError &&
                rows.map((record) => (
                  <TableRow key={record.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(record.date)}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>
                      <MuiLink
                        component={Link}
                        href={`/vehicles/${record.vehicle}`}
                        underline="hover"
                      >
                        {record.vehicle_license_plate}
                      </MuiLink>
                    </TableCell>
                    <TableCell>
                      {TYPE_LABELS[record.maintenance_type] ?? record.maintenance_type}
                    </TableCell>
                    <TableCell>{record.mechanic_name}</TableCell>
                    <TableCell align="right">{formatCurrency(record.cost)}</TableCell>
                    <TableCell
                      sx={{
                        color: 'text.secondary',
                        maxWidth: 260,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={record.notes}
                    >
                      {record.notes || '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          aria-label={`Edit record ${record.id}`}
                          onClick={() => setEditing({ record })}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          aria-label={`Delete record ${record.id}`}
                          onClick={() => setDeleting(record)}
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
        <TablePagination {...paginationProps(records.data?.count, pagination, setParams)} />
      </Paper>

      {editing && (
        <MaintenanceRecordFormDialog
          key={editing.record?.id ?? 'new'}
          record={editing.record}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="Delete maintenance record?"
        message={
          deleting && (
            <>
              The {TYPE_LABELS[deleting.maintenance_type]?.toLowerCase()} on{' '}
              <strong>{deleting.vehicle_license_plate}</strong> from {formatDate(deleting.date)} (
              {formatCurrency(deleting.cost)}) will be permanently deleted.
            </>
          )
        }
        confirmLabel="Delete"
        destructive
        pending={remove.isPending}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
