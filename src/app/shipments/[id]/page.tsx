import { ShipmentDetailView } from "@/components/ShipmentDetailView";

export default async function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ShipmentDetailView key={id} id={id} />;
}
