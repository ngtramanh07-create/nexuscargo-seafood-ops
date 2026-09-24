import { developmentOnly, error, ok } from "@/lib/api-fixture";
import { assignees, recalculateShipment, saveFixture, shipments } from "@/lib/fixture-db";
import { isFixtureMode } from "@/lib/data-source";
import { dbUpdateTask } from "@/lib/db-write";
import type { UpdateTaskRequest } from "@/types/contracts";

export async function PATCH(request: Request, { params }: { params: Promise<{ taskId: string }> }): Promise<Response> {
  if (!isFixtureMode()) {
    const { taskId } = await params;
    try { return dbUpdateTask(taskId, await request.json() as UpdateTaskRequest); }
    catch { return error("VALIDATION_ERROR", "Dữ liệu không hợp lệ.", 400); }
  }
  const denied = developmentOnly(); if (denied) return denied;
  const { taskId } = await params;
  const shipment = shipments.find((row) => row.tasks.some((task) => task.id === taskId));
  const task = shipment?.tasks.find((row) => row.id === taskId);
  if (!shipment || !task) return error("NOT_FOUND", "Không tìm thấy công việc.", 404);
  let input: UpdateTaskRequest;
  try { input = await request.json() as UpdateTaskRequest; } catch { return error("VALIDATION_ERROR", "Dữ liệu không hợp lệ.", 400); }
  if (task.version !== input.expectedVersion) return error("CONFLICT", "Công việc đã đổi. Hãy tải lại trang.", 409);
  const at = new Date().toISOString();
  if (input.action === "ASSIGN") {
    const selected = assignees.find((row) => row.id === input.assigneeId);
    if (!selected || task.status === "DONE") return error("VALIDATION_ERROR", "Bộ phận hoặc trạng thái không hợp lệ.", 400);
    task.assigneeId = selected.id; task.assigneeName = selected.name;
  } else if (input.action === "START") {
    if (task.status !== "OPEN") return error("CONFLICT", "Chỉ bắt đầu việc chưa làm.", 409);
    task.status = "IN_PROGRESS";
  } else if (input.action === "COMPLETE") {
    if (task.status !== "IN_PROGRESS") return error("CONFLICT", "Hãy bắt đầu công việc trước.", 409);
    const evidence = shipment.documents.find((doc) => doc.id === input.evidenceDocumentId && doc.status === "VERIFIED");
    if (!evidence) return error("VALIDATION_ERROR", "Cần chứng từ đã xác nhận thuộc lô này.", 400);
    const expectedType = { SEAL_SI_MATCH: "SI", SI_CONFIRMED: "SI", VGM_CONFIRMED: "VGM", CERT_CONFIRMED: "HEALTH_CERTIFICATE" }[task.sourceCheckCode];
    if (expectedType && evidence.type !== expectedType) return error("VALIDATION_ERROR", `Cần chứng từ loại ${expectedType} làm bằng chứng.`, 400);
    if (task.sourceCheckCode === "SEAL_SI_MATCH" && shipment.siSealNo !== shipment.containers[0]?.sealNo) return error("CONFLICT", "Seal trên SI vẫn chưa khớp container. Hãy cập nhật và xác nhận SI trước.", 409);
    task.status = "DONE"; task.evidenceDocumentId = evidence.id; task.completionNote = input.note?.trim().slice(0, 500) || null;
    const check = shipment.checks.find((row) => row.code === task.sourceCheckCode);
    if (check && ["SEAL_SI_MATCH", "SI_CONFIRMED", "VGM_CONFIRMED", "CERT_CONFIRMED"].includes(check.code)) {
      check.status = "PASS"; check.message = `Đã đối chiếu với ${evidence.type} (${evidence.id}) và hoàn tất công việc.`; check.updatedAt = at;
    }
  } else return error("VALIDATION_ERROR", "Thao tác không hợp lệ.", 400);
  task.version += 1; task.updatedAt = at;
  shipment.auditEvents.unshift({ id: `EVT-${crypto.randomUUID()}`, actorName: task.assigneeName ?? "Bộ phận xử lý", action: `TASK_${input.action}`, description: `${input.action === "COMPLETE" ? "Hoàn tất" : input.action === "START" ? "Bắt đầu" : "Giao"} ${task.title.toLowerCase()}.`, createdAt: at });
  recalculateShipment(shipment); saveFixture();
  return ok({ task, shipmentStatus: shipment.status });
}
