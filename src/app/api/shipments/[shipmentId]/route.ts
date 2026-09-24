import { fixtureReadAllowed, error, ok } from "@/lib/api-fixture";
import { shipments } from "@/lib/fixture-db";
import { isFixtureMode } from "@/lib/data-source";
import { dbShipmentDetail } from "@/lib/db-read";

export async function GET(_request: Request, { params }: { params: Promise<{ shipmentId: string }> }): Promise<Response> {
  const { shipmentId } = await params;
  if (!isFixtureMode()) return dbShipmentDetail(shipmentId);
  const denied = fixtureReadAllowed();
  if (denied) return denied;
  const shipment = shipments.find((item) => item.id === shipmentId);
  return shipment ? ok(shipment) : error("NOT_FOUND", "Không tìm thấy lô hàng.", 404);
}
