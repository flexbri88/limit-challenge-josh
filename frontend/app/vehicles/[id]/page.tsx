import type { Metadata } from 'next';
import VehicleDetailView from './VehicleDetailView';

export const metadata: Metadata = { title: 'Vehicle details' };

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VehicleDetailView id={Number(id)} />;
}
