import { developmentOnly, error, ok } from "@/lib/api-fixture";
import { recalculateShipment, saveFixture, shipments } from "@/lib/fixture-db";
import { isFixtureMode } from "@/lib/data-source";
import type { ReviewDecisionRequest } from "@/types/contracts";

export async function PATCH(request: Request, { params }: { params: Promise<{ reviewId: string }> }): Promise<Response> {
  if (!isFixtureMode()) return error("FORBIDDEN", "Chế độ Supabase chưa bật API ghi.", 501);
  const denied = developmentOnly(); if (denied) return denied;
  const { reviewId } = await params;
  const shipment = shipments.find((row) => row.documents.some((doc) => `REV-${doc.id}` === reviewId));
  const document = shipment?.documents.find((doc) => `REV-${doc.id}` === reviewId);
  if (!shipment || !document) return error("NOT_FOUND", "Không tìm thấy chứng từ.", 404);
  if (document.status !== "PENDING_REVIEW") return error("CONFLICT", "Chứng từ đã được xử lý.", 409);
  let input: ReviewDecisionRequest;
  try { input = await request.json() as ReviewDecisionRequest; } catch { return error("VALIDATION_ERROR", "Dữ liệu không hợp lệ.", 400); }
  if (input.decision !== "APPROVE" && input.decision !== "REJECT") return error("VALIDATION_ERROR", "Quyết định không hợp lệ.", 400);
  if (input.decision === "REJECT" && !input.note?.trim()) return error("VALIDATION_ERROR", "Cần ghi lý do từ chối.", 400);
  if (input.decision === "APPROVE") {
    const confirmedSeal = input.corrections?.find((entry) => entry.key === "sealNo")?.confirmedValue?.trim() || shipment.containers[0]?.sealNo;
    if (document.type === "SI" && !confirmedSeal) return error("VALIDATION_ERROR", "Hãy xác nhận số seal.", 400);
    if (document.type === "SI") shipment.siSealNo = confirmedSeal;
  }
  const at = new Date().toISOString();
  document.status = input.decision === "APPROVE" ? "VERIFIED" : "REJECTED"; document.reviewedAt = at;
  if (input.decision === "APPROVE") {
    const code = document.type === "SI" ? "SI_CONFIRMED" : document.type === "HEALTH_CERTIFICATE" ? "CERT_CONFIRMED" : null;
    const check = shipment.checks.find((row) => row.code === code);
    if (check && (check.status === "PENDING_REVIEW" || check.status === "STALE")) {
      check.status = "PASS"; check.message = `Đã xác nhận chứng từ ${document.id}.`; check.updatedAt = at;
      for (const task of shipment.tasks.filter((row) => row.sourceCheckCode === code && row.status !== "DONE")) {
        task.status = "DONE"; task.evidenceDocumentId = document.id; task.completionNote = "Hoàn tất khi nhân viên xác nhận chứng từ.";
        task.version += 1; task.updatedAt = at;
      }
    }
    if (document.type === "SI") {
      const sealCheck = shipment.checks.find((row) => row.code === "SEAL_SI_MATCH");
      if (sealCheck && sealCheck.status !== "PASS" && shipment.siSealNo === shipment.containers[0]?.sealNo) {
        sealCheck.status = "PASS"; sealCheck.message = `Seal trên SI (${shipment.siSealNo}) khớp container.`; sealCheck.updatedAt = at;
      }
    }
  }
  if (input.decision === "REJECT") {
    const code = document.type === "SI" ? "SI_CONFIRMED" : document.type === "HEALTH_CERTIFICATE" ? "CERT_CONFIRMED" : null;
    const check = shipment.checks.find((row) => row.code === code && row.status === "PENDING_REVIEW");
    if (check) { check.status = "MISSING"; check.message = `Chứng từ ${document.id} bị từ chối; cần bản hợp lệ thay thế.`; check.updatedAt = at; }
  }
  shipment.auditEvents.unshift({ id: `EVT-${crypto.randomUUID()}`, actorName: "Bộ phận Chứng từ", action: `DOCUMENT_${input.decision}`, description: `${input.decision === "APPROVE" ? "Xác nhận" : "Từ chối"} ${document.fileName}${input.decision === "REJECT" ? `: ${input.note.slice(0, 200)}` : "."}`, createdAt: at });
  recalculateShipment(shipment); saveFixture();
  return ok({ document, shipmentStatus: shipment.status });
}
