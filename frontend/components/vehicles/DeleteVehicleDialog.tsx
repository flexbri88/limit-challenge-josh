'use client';

import ConfirmDialog from '@/components/ConfirmDialog';
import { useNotify } from '@/components/NotificationsProvider';
import { useDeleteVehicle } from '@/hooks/use-vehicles';
import { getErrorMessage } from '@/lib/errors';
import type { Vehicle } from '@/lib/types';

interface DeleteVehicleDialogProps {
  vehicle: Vehicle | null;
  onClose: () => void;
  onDeleted?: () => void;
}

export default function DeleteVehicleDialog({
  vehicle,
  onClose,
  onDeleted,
}: DeleteVehicleDialogProps) {
  const notify = useNotify();
  const remove = useDeleteVehicle();

  const handleConfirm = () => {
    if (!vehicle) return;
    remove.mutate(vehicle.id, {
      onSuccess: () => {
        notify(`Vehicle ${vehicle.license_plate} deleted.`);
        onClose();
        onDeleted?.();
      },
      onError: (error) => notify(getErrorMessage(error, 'Could not delete the vehicle.'), 'error'),
    });
  };

  return (
    <ConfirmDialog
      open={vehicle !== null}
      title="Delete vehicle?"
      message={
        <>
          <strong>{vehicle?.license_plate}</strong> and its entire maintenance history will be
          permanently deleted. To keep the history, mark the vehicle inactive instead.
        </>
      }
      confirmLabel="Delete"
      destructive
      pending={remove.isPending}
      onConfirm={handleConfirm}
      onClose={onClose}
    />
  );
}
