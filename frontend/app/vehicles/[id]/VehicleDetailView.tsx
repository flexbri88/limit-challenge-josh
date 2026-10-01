'use client';

import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MoveUpIcon from '@mui/icons-material/MoveUp';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import MaintenanceRecordFormDialog from '@/components/maintenance/MaintenanceRecordFormDialog';
import PageHeader from '@/components/PageHeader';
import { EmptyState, ErrorState, TableMessageRow } from '@/components/QueryStates';
import StatusChip from '@/components/StatusChip';
import AssignOfficeDialog from '@/components/vehicles/AssignOfficeDialog';
import DeleteVehicleDialog from '@/components/vehicles/DeleteVehicleDialog';
import VehicleFormDialog from '@/components/vehicles/VehicleFormDialog';
import { useVehicleDetail } from '@/hooks/use-vehicles';
import { isNotFound } from '@/lib/errors';
import { formatCurrency, formatDate, formatDaysAgo, todayIso } from '@/lib/format';
import type { VehicleDetail } from '@/lib/types';

const HISTORY_PAGE_SIZE = 10;
const MAINTENANCE_INTERVAL_DAYS = 365;

type OpenDialog = 'edit' | 'assign' | 'delete' | null;

export default function VehicleDetailView({ id }: { id: number }) {
  const router = useRouter();
  const vehicle = useVehicleDetail(id);
  const [dialog, setDialog] = useState<OpenDialog>(null);

  const backLink = (
    <Button
      component={Link}
      href="/vehicles"
      startIcon={<ArrowBackIcon />}
      size="small"
      sx={{ mb: 1, ml: -1 }}
    >
      Vehicles
    </Button>
  );

  if (!Number.isInteger(id) || id <= 0 || isNotFound(vehicle.error)) {
    return (
      <>
        {backLink}
        <Paper>
          <EmptyState
            icon={<SearchOffIcon />}
            title="Vehicle not found"
            description="It may have been deleted, or the link is incorrect."
            action={
              <Button component={Link} href="/vehicles" variant="contained">
                Back to vehicles
              </Button>
            }
          />
        </Paper>
      </>
    );
  }

  if (vehicle.isError) {
    return (
      <>
        {backLink}
        <ErrorState error={vehicle.error} onRetry={() => vehicle.refetch()} />
      </>
    );
  }

  if (vehicle.isPending) return <DetailSkeleton backLink={backLink} />;

  const data = vehicle.data;

  return (
    <>
      <PageHeader
        overline={backLink}
        title={
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <span>{data.license_plate}</span>
            <StatusChip active={data.is_active} />
          </Stack>
        }
        subtitle={`${data.year} ${data.make} ${data.model}`}
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<MoveUpIcon />}
              onClick={() => setDialog('assign')}
            >
              Move office
            </Button>
            <Button
              variant="outlined"
              startIcon={<EditOutlinedIcon />}
              onClick={() => setDialog('edit')}
            >
              Edit
            </Button>
            <Button
              color="error"
              startIcon={<DeleteOutlineIcon />}
              onClick={() => setDialog('delete')}
            >
              Delete
            </Button>
          </>
        }
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper sx={{ p: 2.5, height: '100%' }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Vehicle
            </Typography>
            <Stack spacing={1.5}>
              <Fact
                label="VIN"
                value={
                  <Box component="span" sx={{ fontFamily: 'var(--font-geist-mono), monospace' }}>
                    {data.vin}
                  </Box>
                }
              />
              <Fact
                label="Office"
                value={`${data.office_detail.name} · ${data.office_detail.city}`}
              />
              <Fact label="Make & model" value={`${data.make} ${data.model} (${data.year})`} />
            </Stack>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          <MaintenanceSummary vehicle={data} />
        </Grid>
      </Grid>

      <MaintenanceHistory vehicle={data} />

      {dialog === 'edit' && (
        <VehicleFormDialog open vehicle={data} onClose={() => setDialog(null)} />
      )}
      {dialog === 'assign' && (
        <AssignOfficeDialog open vehicle={data} onClose={() => setDialog(null)} />
      )}
      <DeleteVehicleDialog
        vehicle={dialog === 'delete' ? data : null}
        onClose={() => setDialog(null)}
        onDeleted={() => router.push('/vehicles')}
      />
    </>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1">{value}</Typography>
    </Box>
  );
}

function daysSince(isoDate: string) {
  return Math.round((Date.parse(todayIso()) - Date.parse(isoDate)) / 86_400_000);
}

function MaintenanceSummary({ vehicle }: { vehicle: VehicleDetail }) {
  const overdue =
    vehicle.is_active &&
    (vehicle.last_maintenance === null ||
      daysSince(vehicle.last_maintenance) > MAINTENANCE_INTERVAL_DAYS);

  return (
    <Paper sx={{ p: 2.5, height: '100%' }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2" color="text.secondary">
          Maintenance
        </Typography>
        {overdue && <Chip size="small" color="warning" label="Maintenance due" />}
      </Stack>
      <Grid container spacing={2}>
        <Grid size={4}>
          <Stat label="Records" value={vehicle.maintenance_count.toLocaleString()} />
        </Grid>
        <Grid size={4}>
          <Stat label="Total cost" value={formatCurrency(vehicle.total_maintenance_cost)} />
        </Grid>
        <Grid size={4}>
          <Stat
            label="Last service"
            value={formatDate(vehicle.last_maintenance, 'Never')}
            hint={
              vehicle.last_maintenance
                ? formatDaysAgo(daysSince(vehicle.last_maintenance))
                : undefined
            }
          />
        </Grid>
      </Grid>
      {overdue && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {vehicle.last_maintenance
            ? 'This vehicle has not been serviced in over a year.'
            : 'This vehicle has never been serviced.'}
        </Alert>
      )}
    </Paper>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Box>
  );
}

function MaintenanceHistory({ vehicle }: { vehicle: VehicleDetail }) {
  const [page, setPage] = useState(0);
  const [logging, setLogging] = useState(false);
  const records = vehicle.maintenance_records;
  const visible = records.slice(page * HISTORY_PAGE_SIZE, (page + 1) * HISTORY_PAGE_SIZE);

  return (
    <Paper sx={{ overflow: 'hidden' }}>
      <Stack
        direction="row"
        spacing={2}
        sx={{ px: 2.5, pt: 2, justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <Box>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            Maintenance history
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Newest first
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setLogging(true)}>
          Log maintenance
        </Button>
      </Stack>
      {logging && (
        <MaintenanceRecordFormDialog
          vehicle={{ id: vehicle.id, license_plate: vehicle.license_plate }}
          onClose={() => {
            setLogging(false);
            setPage(0);
          }}
        />
      )}
      <TableContainer>
        <Table aria-label="Maintenance history">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Mechanic</TableCell>
              <TableCell align="right">Cost</TableCell>
              <TableCell>Notes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {records.length === 0 && (
              <TableMessageRow columns={5}>
                <EmptyState
                  title="No maintenance recorded"
                  description="Maintenance performed on this vehicle will appear here."
                />
              </TableMessageRow>
            )}
            {visible.map((record) => (
              <TableRow key={record.id}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(record.date)}</TableCell>
                <TableCell>{record.maintenance_type_display}</TableCell>
                <TableCell>
                  <Typography variant="body2">{record.mechanic.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {record.mechanic.certification_number}
                    {!record.mechanic.is_active && ' · no longer active'}
                  </Typography>
                </TableCell>
                <TableCell align="right">{formatCurrency(record.cost)}</TableCell>
                <TableCell sx={{ color: 'text.secondary', maxWidth: 320 }}>
                  {record.notes || '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {records.length > HISTORY_PAGE_SIZE && (
        <TablePagination
          component="div"
          count={records.length}
          page={page}
          rowsPerPage={HISTORY_PAGE_SIZE}
          rowsPerPageOptions={[HISTORY_PAGE_SIZE]}
          onPageChange={(_, next) => setPage(next)}
        />
      )}
    </Paper>
  );
}

function DetailSkeleton({ backLink }: { backLink: ReactNode }) {
  return (
    <>
      {backLink}
      <Skeleton variant="text" width={240} height={48} />
      <Skeleton variant="text" width={180} sx={{ mb: 3 }} />
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Skeleton variant="rounded" height={180} />
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          <Skeleton variant="rounded" height={180} />
        </Grid>
      </Grid>
      <Skeleton variant="rounded" height={320} />
    </>
  );
}
