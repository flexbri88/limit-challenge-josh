import { Chip } from '@mui/material';

export default function StatusChip({ active }: { active: boolean }) {
  return (
    <Chip
      size="small"
      label={active ? 'Active' : 'Inactive'}
      color={active ? 'success' : 'default'}
      variant={active ? 'filled' : 'outlined'}
    />
  );
}
