import { error, ok } from "@/lib/api-fixture";
import { dbShipmentDetail, requireReader } from "@/lib/db-read";
import type { ApiSuccess, ReviewDecisionRequest, ShipmentDetail, UpdateTaskRequest } from "@/types/contracts";

async function detail(shipmentId: string): Promise<ShipmentDetail | Response> {
  const response = await dbShipmentDetail(shipmentId);
  if (!response.ok) return response;
  return ((await response.json()) as ApiSuccess<ShipmentDetail>).data;
}

function writeError(cause: { code?: string; message: string }): Response {
  if (cause.code === "P0001") return error("CONFLICT", cause.message, 409);
  console.error("NexusCargo database write error:", cause);
  return error("INTERNAL_ERROR", "Không lưu được thay đổi. Hãy kiểm tra migration rồi thử lại.", 500);
}

export async function dbUpdateTask(taskId: string, input: UpdateTaskRequest): Promise<Response> {
  if (!input || !Number.isInteger(input.expectedVersion) || !["ASSIGN", "START", "COMPLETE"].includes(input.action)) {
    return error("VALIDATION_ERROR", "Dữ liệu công việc không hợp lệ.", 400);
  }
  if (input.action === "ASSIGN" && (typeof input.assigneeId !== "string" || !input.assigneeId)) return error("VALIDATION_ERROR", "Chọn người nhận.", 400);
  if (input.action === "COMPLETE" && (typeof input.evidenceDocumentId !== "string" || !input.evidenceDocumentId)) return error("VALIDATION_ERROR", "Chọn chứng từ bằng chứng.", 400);
  const context = await requireReader();
  if (context instanceof Response) return context;
  const { data: original, error: readError } = await context.db.from("tasks").select("shipment_id").eq("id", taskId).maybeSingle();
  if (readError) return writeError(readError);
  if (!original) return error("NOT_FOUND", "Không tìm thấy công việc.", 404);
  const { data: shipmentStatus, error: dbError } = await context.db.rpc("nexus_update_task", {
    p_task_id: taskId, p_expected_version: input.expectedVersion, p_action: input.action,
    p_assignee_id: input.action === "ASSIGN" ? input.assigneeId : null,
    p_evidence_document_id: input.action === "COMPLETE" ? input.evidenceDocumentId : null,
    p_note: input.action === "COMPLETE" ? input.note ?? null : null,
  });
  if (dbError) return writeError(dbError);
  const result = await detail(original.shipment_id as string);
  if (result instanceof Response) return result;
  return ok({ task: result.tasks.find((task) => task.id === taskId), shipmentStatus });
}

export async function dbReviewDocument(reviewId: string, input: ReviewDecisionRequest): Promise<Response> {
  if (!input || !["APPROVE", "REJECT"].includes(input.decision) ||
    (input.decision === "REJECT" && (typeof input.note !== "string" || !input.note.trim())) ||
    (input.decision === "APPROVE" && !Array.isArray(input.corrections))) {
    return error("VALIDATION_ERROR", "Quyết định hoặc lý do không hợp lệ.", 400);
  }
  const context = await requireReader();
  if (context instanceof Response) return context;
  const { data: original, error: readError } = await context.db.from("documents").select("id, shipment_id")
    .eq("review_id", reviewId).maybeSingle();
  if (readError) return writeError(readError);
  if (!original) return error("NOT_FOUND", "Không tìm thấy chứng từ.", 404);
  const { data: shipmentStatus, error: dbError } = await context.db.rpc("nexus_review_document", {
    p_review_id: reviewId, p_decision: input.decision,
    p_corrections: input.decision === "APPROVE" ? input.corrections : [],
    p_note: input.decision === "REJECT" ? input.note : null,
  });
  if (dbError) return writeError(dbError);
  const result = await detail(original.shipment_id as string);
  if (result instanceof Response) return result;
  return ok({ document: result.documents.find((doc) => doc.id === original.id), shipmentStatus });
}

export async function dbUpdateSeal(shipmentId: string, sealNo: string): Promise<Response> {
  if (!/^[A-Z0-9-]{4,32}$/.test(sealNo)) return error("VALIDATION_ERROR", "Số seal phải gồm 4–32 ký tự in hoa, số hoặc dấu gạch nối.", 400);
  const context = await requireReader();
  if (context instanceof Response) return context;
  const { error: dbError } = await context.db.rpc("nexus_update_si_seal", { p_shipment_id: shipmentId, p_seal_no: sealNo });
  if (dbError) return writeError(dbError);
  const result = await detail(shipmentId);
  return result instanceof Response ? result : ok(result);
}
