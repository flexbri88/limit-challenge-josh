'use client';

import {
  Box,
  Button,
  Chip,
  Grid,
  LinearProgress,
  Link as MuiLink,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import PageHeader from '@/components/PageHeader';
import {
  EmptyState,
  ErrorState,
  ListErrorState,
  TableMessageRow,
  TableSkeletonRows,
} from '@/components/QueryStates';
import { useMechanicWorkload } from '@/hooks/use-mechanics';
import { useOfficeSummary } from '@/hooks/use-offices';
import { useVehiclesNeedingMaintenance } from '@/hooks/use-vehicles';
import { formatCurrency, formatDate, formatDaysAgo } from '@/lib/format';

const DUE_PAGE_SIZE = 6;
const WORKLOAD_ROWS = 6;

export default function DashboardView() {
  const summary = useOfficeSummary();
  const workload = useMechanicWorkload();
  const [duePage, setDuePage] = useState(1);
  const due = useVehiclesNeedingMaintenance({ page: duePage, page_size: DUE_PAGE_SIZE });

  const offices = summary.data ?? [];
  const activeVehicles = offices.reduce((total, office) => total + office.active_vehicle_count, 0);
  const yearCost = offices.reduce((total, office) => total + office.maintenance_cost_last_year, 0);
  const busiest = workload.data?.results[0];

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Fleet health at a glance." />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatTile
            label="Active vehicles"
            loading={summary.isPending}
            value={activeVehicles.toLocaleString()}
            hint={`across ${offices.length} offices`}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatTile
            label="Maintenance cost, last 12 months"
            loading={summary.isPending}
            value={formatCurrency(yearCost)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatTile
            label="Vehicles needing maintenance"
            loading={due.isPending}
            value={(due.data?.count ?? 0).toLocaleString()}
            hint="never serviced or over a year ago"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatTile
            label={`Busiest mechanic ${workload.data?.year ?? ''}`}
            loading={workload.isPending}
            value={busiest && busiest.maintenance_count > 0 ? busiest.name : '—'}
            hint={
              busiest && busiest.maintenance_count > 0
                ? `${busiest.maintenance_count} jobs this year`
                : undefined
            }
          />
        </Grid>
      </Grid>

      <Section title="Offices" subtitle="Maintenance cost covers the last 12 months.">
        <TableContainer>
          <Table aria-label="Office summary">
            <TableHead>
              <TableRow>
                <TableCell>Office</TableCell>
                <TableCell>City</TableCell>
                <TableCell align="right">Active vehicles</TableCell>
                <TableCell align="right">Maintenance cost</TableCell>
                <TableCell align="right">Last maintenance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summary.isPending && <TableSkeletonRows columns={5} rows={4} />}
              {summary.isError && (
                <TableMessageRow columns={5}>
                  <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
                </TableMessageRow>
              )}
              {summary.isSuccess && offices.length === 0 && (
                <TableMessageRow columns={5}>
                  <EmptyState
                    title="No offices yet"
                    action={
                      <Button component={Link} href="/offices">
                        Add an office
                      </Button>
                    }
                  />
                </TableMessageRow>
              )}
              {offices.map((office) => (
                <TableRow key={office.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>
                    <MuiLink
                      component={Link}
                      href={`/vehicles?office=${office.id}&is_active=true`}
                      underline="hover"
                    >
                      {office.name}
                    </MuiLink>
                  </TableCell>
                  <TableCell>{office.city}</TableCell>
                  <TableCell align="right">{office.active_vehicle_count}</TableCell>
                  <TableCell align="right">
                    {formatCurrency(office.maintenance_cost_last_year)}
                  </TableCell>
                  <TableCell align="right">
                    {formatDate(office.last_maintenance, 'Never')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Section>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Section
            title="Needs maintenance"
            subtitle="Active vehicles, longest without service first."
          >
            {due.isPending && <ListSkeleton rows={DUE_PAGE_SIZE} />}
            {due.isError && (
              <Box sx={{ p: 2 }}>
                <ListErrorState
                  error={due.error}
                  page={duePage}
                  onFirstPage={() => setDuePage(1)}
                  onRetry={() => due.refetch()}
                />
              </Box>
            )}
            {due.isSuccess && due.data.count === 0 && (
              <EmptyState
                title="All caught up"
                description="Every active vehicle was serviced in the last year."
              />
            )}
            {!due.isError && due.data && due.data.count > 0 && (
              <>
                <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
                  {due.data.results.map((vehicle) => (
                    <Stack
                      key={vehicle.id}
                      direction="row"
                      spacing={2}
                      sx={{
                        px: 2.5,
                        py: 1.5,
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <MuiLink
                          component={Link}
                          href={`/vehicles/${vehicle.id}`}
                          underline="hover"
                          sx={{ fontWeight: 600 }}
                        >
                          {vehicle.license_plate}
                        </MuiLink>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.office_name}
                        </Typography>
                      </Box>
                      {vehicle.last_maintenance ? (
                        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                          <Typography variant="body2">
                            {formatDate(vehicle.last_maintenance)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDaysAgo(vehicle.days_since_last_maintenance ?? 0)}
                          </Typography>
                        </Box>
                      ) : (
                        <Chip
                          size="small"
                          color="warning"
                          variant="outlined"
                          label="Never serviced"
                        />
                      )}
                    </Stack>
                  ))}
                </Stack>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    px: 2.5,
                    py: 1.5,
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    borderTop: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="body2" color="text.secondary" sx={{ mr: 'auto' }}>
                    {due.data.count} vehicles
                  </Typography>
                  <Button
                    size="small"
                    disabled={!due.data.previous || due.isFetching}
                    onClick={() => setDuePage((page) => page - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    size="small"
                    disabled={!due.data.next || due.isFetching}
                    onClick={() => setDuePage((page) => page + 1)}
                  >
                    Next
                  </Button>
                </Stack>
              </>
            )}
          </Section>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Section
            title={`Mechanic workload ${workload.data?.year ?? ''}`}
            subtitle="Jobs completed this year, busiest first."
          >
            {workload.isPending && <ListSkeleton rows={WORKLOAD_ROWS} />}
            {workload.isError && (
              <Box sx={{ p: 2 }}>
                <ErrorState error={workload.error} onRetry={() => workload.refetch()} />
              </Box>
            )}
            {workload.isSuccess && workload.data.results.length === 0 && (
              <EmptyState
                title="No mechanics yet"
                action={
                  <Button component={Link} href="/mechanics">
                    Add a mechanic
                  </Button>
                }
              />
            )}
            {workload.data && workload.data.results.length > 0 && (
              <Stack spacing={2} sx={{ px: 2.5, py: 2 }}>
                {workload.data.results.slice(0, WORKLOAD_ROWS).map((mechanic) => {
                  const max = workload.data.results[0].maintenance_count || 1;
                  return (
                    <Box key={mechanic.id}>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ justifyContent: 'space-between', mb: 0.5 }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                          {mechanic.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                          {mechanic.maintenance_count} jobs ·{' '}
                          {formatCurrency(mechanic.total_maintenance_cost)}
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={(mechanic.maintenance_count / max) * 100}
                        aria-label={`${mechanic.name}: ${mechanic.maintenance_count} jobs`}
                        sx={{
                          height: 6,
                          borderRadius: 3,
                          bgcolor: 'action.hover',
                          '& .MuiLinearProgress-bar': { borderRadius: 3 },
                        }}
                      />
                    </Box>
                  );
                })}
                {workload.data.results.length > WORKLOAD_ROWS && (
                  <Typography variant="caption" color="text.secondary">
                    +{workload.data.results.length - WORKLOAD_ROWS} more mechanics
                  </Typography>
                )}
              </Stack>
            )}
          </Section>
        </Grid>
      </Grid>
    </>
  );
}

function StatTile({
  label,
  value,
  hint,
  loading,
}: {
  label: string;
  value: string;
  hint?: string;
  loading: boolean;
}) {
  return (
    <Paper sx={{ p: 2.5, height: '100%' }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      {loading ? (
        <Skeleton variant="text" width="60%" height={40} />
      ) : (
        <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }} noWrap>
          {value}
        </Typography>
      )}
      {hint && !loading && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Paper>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <Paper sx={{ overflow: 'hidden', mb: 3 }}>
      <Box sx={{ px: 2.5, pt: 2, pb: 1 }}>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
      {children}
    </Paper>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <Stack spacing={1} sx={{ px: 2.5, pb: 2 }}>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} variant="text" height={36} />
      ))}
    </Stack>
  );
}
