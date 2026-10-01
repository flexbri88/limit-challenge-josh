'use client';

import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import {
  Box,
  Button,
  IconButton,
  LinearProgress,
  Link as MuiLink,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material';
import Link from 'next/link';
import { useState } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';
import MechanicFormDialog from '@/components/mechanics/MechanicFormDialog';
import { useNotify } from '@/components/NotificationsProvider';
import PageHeader from '@/components/PageHeader';
import {
  EmptyState,
  ListErrorState,
  TableMessageRow,
  TableSkeletonRows,
} from '@/components/QueryStates';
import StatusChip from '@/components/StatusChip';
import { useDeleteMechanic, useMechanics } from '@/hooks/use-mechanics';
import {
  pageAfterDelete,
  paginationProps,
  readPagination,
  useSearchParamsState,
} from '@/hooks/use-search-params-state';
import { getErrorMessage } from '@/lib/errors';
import type { Mechanic } from '@/lib/types';

const COLUMNS = 4;

export default function MechanicsView() {
  const notify = useNotify();
  const [searchParams, setParams] = useSearchParamsState();
  const pagination = readPagination(searchParams);
  const status = searchParams.get('is_active') ?? '';
  const mechanics = useMechanics({
    page: pagination.page,
    page_size: pagination.pageSize,
    is_active: status || undefined,
  });
  const remove = useDeleteMechanic();
  const [editing, setEditing] = useState<{ mechanic?: Mechanic } | null>(null);
  const [deleting, setDeleting] = useState<Mechanic | null>(null);

  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        notify(`Mechanic ${deleting.name} deleted.`);
        setParams({ page: pageAfterDelete(mechanics.data?.results.length ?? 0, pagination.page) });
      },
      onError: (error) => notify(getErrorMessage(error, 'Could not delete the mechanic.'), 'error'),
      onSettled: () => setDeleting(null),
    });
  };

  return (
    <>
      <PageHeader
        title="Mechanics"
        subtitle="Only active mechanics can be assigned new maintenance work."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing({})}>
            Add mechanic
          </Button>
        }
      />

      <ToggleButtonGroup
        exclusive
        size="small"
        value={status}
        onChange={(_, value: string | null) => value !== null && setParams({ is_active: value })}
        aria-label="Filter by status"
        sx={{ mb: 2, bgcolor: 'background.paper' }}
      >
        <ToggleButton value="">All</ToggleButton>
        <ToggleButton value="true">Active</ToggleButton>
        <ToggleButton value="false">Inactive</ToggleButton>
      </ToggleButtonGroup>

      <Paper sx={{ overflow: 'hidden' }}>
        <Box sx={{ height: 4 }}>
          {mechanics.isFetching && !mechanics.isPending && <LinearProgress />}
        </Box>
        <TableContainer>
          <Table aria-label="Mechanics">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Certification #</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right" aria-label="Actions" />
              </TableRow>
            </TableHead>
            <TableBody>
              {mechanics.isPending && <TableSkeletonRows columns={COLUMNS} />}
              {mechanics.isError && (
                <TableMessageRow columns={COLUMNS}>
                  <ListErrorState
                    error={mechanics.error}
                    page={pagination.page}
                    onFirstPage={() => setParams({ page: null })}
                    onRetry={() => mechanics.refetch()}
                  />
                </TableMessageRow>
              )}
              {mechanics.isSuccess && mechanics.data.results.length === 0 && (
                <TableMessageRow columns={COLUMNS}>
                  <EmptyState
                    title={status ? 'No mechanics with this status' : 'No mechanics yet'}
                    action={
                      status ? (
                        <Button onClick={() => setParams({ is_active: null })}>Show all</Button>
                      ) : (
                        <Button startIcon={<AddIcon />} onClick={() => setEditing({})}>
                          Add mechanic
                        </Button>
                      )
                    }
                  />
                </TableMessageRow>
              )}
              {!mechanics.isError &&
                mechanics.data?.results.map((mechanic) => (
                  <TableRow key={mechanic.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{mechanic.name}</TableCell>
                    <TableCell>
                      <Tooltip title="Vehicles this mechanic has serviced" describeChild>
                        <MuiLink
                          component={Link}
                          href={`/vehicles?mechanic_certification=${encodeURIComponent(mechanic.certification_number)}`}
                          underline="hover"
                        >
                          {mechanic.certification_number}
                        </MuiLink>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <StatusChip active={mechanic.is_active} />
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          aria-label={`Edit ${mechanic.name}`}
                          onClick={() => setEditing({ mechanic })}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          aria-label={`Delete ${mechanic.name}`}
                          onClick={() => setDeleting(mechanic)}
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
        <TablePagination {...paginationProps(mechanics.data?.count, pagination, setParams)} />
      </Paper>

      {editing && (
        <MechanicFormDialog
          key={editing.mechanic?.id ?? 'new'}
          mechanic={editing.mechanic}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="Delete mechanic?"
        message={
          <>
            <strong>{deleting?.name}</strong> will be deleted. Mechanics with maintenance history
            cannot be deleted; mark them inactive instead.
          </>
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
