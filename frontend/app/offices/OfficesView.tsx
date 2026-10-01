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
  Tooltip,
} from '@mui/material';
import Link from 'next/link';
import { useState } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useNotify } from '@/components/NotificationsProvider';
import OfficeFormDialog from '@/components/offices/OfficeFormDialog';
import PageHeader from '@/components/PageHeader';
import {
  EmptyState,
  ListErrorState,
  TableMessageRow,
  TableSkeletonRows,
} from '@/components/QueryStates';
import { useDeleteOffice, useOffices } from '@/hooks/use-offices';
import {
  pageAfterDelete,
  paginationProps,
  readPagination,
  useSearchParamsState,
} from '@/hooks/use-search-params-state';
import { getErrorMessage } from '@/lib/errors';
import type { Office } from '@/lib/types';

const COLUMNS = 3;

export default function OfficesView() {
  const notify = useNotify();
  const [searchParams, setParams] = useSearchParamsState();
  const pagination = readPagination(searchParams);
  const offices = useOffices({ page: pagination.page, page_size: pagination.pageSize });
  const remove = useDeleteOffice();
  const [editing, setEditing] = useState<{ office?: Office } | null>(null);
  const [deleting, setDeleting] = useState<Office | null>(null);

  const confirmDelete = () => {
    if (!deleting) return;
    remove.mutate(deleting.id, {
      onSuccess: () => {
        notify(`Office ${deleting.name} deleted.`);
        setParams({ page: pageAfterDelete(offices.data?.results.length ?? 0, pagination.page) });
      },
      // e.g. 409: "Cannot delete this item because it is still referenced by 12 vehicles."
      onError: (error) => notify(getErrorMessage(error, 'Could not delete the office.'), 'error'),
      onSettled: () => setDeleting(null),
    });
  };

  return (
    <>
      <PageHeader
        title="Offices"
        subtitle="Locations that vehicles are assigned to."
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing({})}>
            Add office
          </Button>
        }
      />
      <Paper sx={{ overflow: 'hidden' }}>
        <Box sx={{ height: 4 }}>
          {offices.isFetching && !offices.isPending && <LinearProgress />}
        </Box>
        <TableContainer>
          <Table aria-label="Offices">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>City</TableCell>
                <TableCell align="right" aria-label="Actions" />
              </TableRow>
            </TableHead>
            <TableBody>
              {offices.isPending && <TableSkeletonRows columns={COLUMNS} />}
              {offices.isError && (
                <TableMessageRow columns={COLUMNS}>
                  <ListErrorState
                    error={offices.error}
                    page={pagination.page}
                    onFirstPage={() => setParams({ page: null })}
                    onRetry={() => offices.refetch()}
                  />
                </TableMessageRow>
              )}
              {offices.isSuccess && offices.data.results.length === 0 && (
                <TableMessageRow columns={COLUMNS}>
                  <EmptyState
                    title="No offices yet"
                    description="Create an office before adding vehicles to it."
                    action={
                      <Button startIcon={<AddIcon />} onClick={() => setEditing({})}>
                        Add office
                      </Button>
                    }
                  />
                </TableMessageRow>
              )}
              {!offices.isError &&
                offices.data?.results.map((office) => (
                  <TableRow key={office.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>
                      <Tooltip title="View this office's vehicles" describeChild>
                        <MuiLink
                          component={Link}
                          href={`/vehicles?office=${office.id}`}
                          underline="hover"
                        >
                          {office.name}
                        </MuiLink>
                      </Tooltip>
                    </TableCell>
                    <TableCell>{office.city}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          aria-label={`Edit ${office.name}`}
                          onClick={() => setEditing({ office })}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          aria-label={`Delete ${office.name}`}
                          onClick={() => setDeleting(office)}
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
        <TablePagination {...paginationProps(offices.data?.count, pagination, setParams)} />
      </Paper>

      {editing && (
        <OfficeFormDialog
          key={editing.office?.id ?? 'new'}
          office={editing.office}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="Delete office?"
        message={
          <>
            <strong>{deleting?.name}</strong> will be deleted. Offices that still have vehicles
            cannot be deleted; move their vehicles first.
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
