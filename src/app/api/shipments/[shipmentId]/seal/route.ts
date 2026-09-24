import { developmentOnly, error, ok } from "@/lib/api-fixture";
import { recalculateShipment, saveFixture, shipments } from "@/lib/fixture-db";
import { isFixtureMode } from "@/lib/data-source";
import { dbUpdateSeal } from "@/lib/db-write";

export async function PATCH(request: Request, { params }: { params: Promise<{ shipmentId: string }> }): Promise<Response> {
  if (!isFixtureMode()) {
    const { shipmentId } = await params;
    try { return dbUpdateSeal(shipmentId, String((await request.json()).sealNo ?? "").trim()); }
    catch { return error("VALIDATION_ERROR", "Dữ liệu không hợp lệ.", 400); }
  }
  const denied = developmentOnly(); if (denied) return denied;
  const { shipmentId } = await params;
  const shipment = shipments.find((row) => row.id === shipmentId);
  if (!shipment) return error("NOT_FOUND", "Không tìm thấy lô.", 404);
  const si = shipment.documents.find((doc) => doc.type === "SI" && doc.status === "VERIFIED");
  if (!si) return error("CONFLICT", "Cần SI đã được nhân viên xác nhận.", 409);
  let sealNo: string;
  try { sealNo = String((await request.json()).sealNo ?? "").trim(); } catch { return error("VALIDATION_ERROR", "Dữ liệu không hợp lệ.", 400); }
  if (!/^[A-Z0-9-]{4,32}$/.test(sealNo)) return error("VALIDATION_ERROR", "Số seal phải gồm 4–32 ký tự in hoa, số hoặc dấu gạch nối.", 400);
  const at = new Date().toISOString();
  shipment.siSealNo = sealNo;
  const check = shipment.checks.find((row) => row.code === "SEAL_SI_MATCH");
  if (check) {
    check.status = sealNo === shipment.containers[0]?.sealNo ? "PENDING_REVIEW" : "MISMATCH";
    check.message = sealNo === shipment.containers[0]?.sealNo
      ? `Seal SI ${sealNo} đã khớp container; chờ hoàn tất đối chiếu với ${si.id}.`
      : `Seal SI ${sealNo} chưa khớp seal container ${shipment.containers[0]?.sealNo}.`;
    check.updatedAt = at;
  }
  shipment.auditEvents.unshift({ id: `EVT-${crypto.randomUUID()}`, actorName: "Bộ phận Chứng từ", action: "SI_SEAL_UPDATED", description: `Đã cập nhật giá trị seal trên SI thành ${sealNo} trong dữ liệu mẫu; chứng từ ${si.id} cần đối chiếu.`, createdAt: at });
  recalculateShipment(shipment); saveFixture();
  return ok(shipment);
}
