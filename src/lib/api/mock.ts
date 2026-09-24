/** Ephemeral UI preview: no request sends a document or writes to the server. */
import { useSyncExternalStore } from "react";
import { ApiRequestError } from "@/lib/api/client";
import type {
  AssigneeOption,
  DocumentRecord,
  DocumentType,
  ReviewDecisionRequest,
  ReviewDecisionResult,
  ReviewItem,
  ShipmentDetail,
  ShipmentStatus,
  Task,
  UpdateTaskRequest,
  UpdateTaskResult,
  UploadDocumentResult,
} from "@/types/contracts";

const taskOverrides = new Map<string, Task>();
const documentOverrides = new Map<string, DocumentRecord>();
const addedDocuments = new Map<string, DocumentRecord[]>();
const reviewedIds = new Set<string>();
const subscribers = new Set<() => void>();
let revision = 0;

function notifyChange() {
  revision += 1;
  subscribers.forEach((callback) => callback());
}

function subscribe(callback: () => void): () => void {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

export function useMockRevision(): number {
  return useSyncExternalStore(subscribe, () => revision, () => 0);
}

export function previewTask(task: Task): Task {
  return taskOverrides.get(task.id) ?? task;
}

export function previewReview(item: ReviewItem): boolean {
  return !reviewedIds.has(item.id);
}

export function previewShipment(shipment: ShipmentDetail): ShipmentDetail {
  return {
    ...shipment,
    tasks: shipment.tasks.map(previewTask),
    documents: [
      ...shipment.documents.map((document) => documentOverrides.get(document.id) ?? document),
      ...(addedDocuments.get(shipment.id) ?? []),
    ],
  };
}

export function mockUpdateTask(
  task: Task,
  request: UpdateTaskRequest,
  assignees: AssigneeOption[],
  documents: DocumentRecord[],
  shipmentStatus: ShipmentStatus,
): UpdateTaskResult {
  const current = previewTask(task);
  if (current.version !== request.expectedVersion) {
    throw new ApiRequestError("Phiên bản công việc đã đổi. Hãy mở lại công việc.", 409);
  }
  const updatedAt = new Date().toISOString();
  let next: Task;
  if (request.action === "ASSIGN") {
    const assignee = assignees.find((person) => person.id === request.assigneeId);
    if (!assignee) throw new ApiRequestError("Hãy chọn người phụ trách hợp lệ.", 400);
    next = { ...current, assigneeId: assignee.id, assigneeName: assignee.name, updatedAt, version: current.version + 1 };
  } else if (request.action === "START") {
    if (current.status !== "OPEN") throw new ApiRequestError("Chỉ bắt đầu công việc đang mở.", 400);
    next = { ...current, status: "IN_PROGRESS", updatedAt, version: current.version + 1 };
  } else {
    if (current.status !== "IN_PROGRESS") throw new ApiRequestError("Hãy bắt đầu công việc trước khi hoàn tất.", 400);
    const evidence = documents.find((document) => document.id === request.evidenceDocumentId && document.status === "VERIFIED" && document.shipmentId === current.shipmentId);
    if (!evidence) throw new ApiRequestError("Chọn chứng từ đã xác nhận thuộc đúng lô hàng.", 400);
    next = { ...current, status: "DONE", evidenceDocumentId: evidence.id, completionNote: request.note?.trim() || null, updatedAt, version: current.version + 1 };
  }
  taskOverrides.set(task.id, next);
  notifyChange();
  // This status is the last value returned by the read API. Only A can recalculate it.
  return { task: next, shipmentStatus };
}

export function mockReviewDecision(
  item: ReviewItem,
  request: ReviewDecisionRequest,
  shipmentStatus: ShipmentStatus,
): ReviewDecisionResult {
  if (reviewedIds.has(item.id)) throw new ApiRequestError("Mục này đã được xem trước trong phiên này.", 409);
  if (request.decision === "APPROVE") {
    const corrections = new Map(request.corrections.map((entry) => [entry.key, entry.confirmedValue.trim()]));
    for (const field of item.fields) {
      if (field.needsReview && !(corrections.get(field.key) ?? field.suggestedValue ?? "").trim()) {
        throw new ApiRequestError(`Hãy xác nhận ${field.label.toLowerCase()} trước khi duyệt.`, 400);
      }
    }
  } else if (!request.note.trim()) {
    throw new ApiRequestError("Hãy ghi lý do từ chối.", 400);
  }
  const document: DocumentRecord = {
    ...item.document,
    status: request.decision === "APPROVE" ? "VERIFIED" : "REJECTED",
    reviewedAt: new Date().toISOString(),
  };
  documentOverrides.set(document.id, document);
  reviewedIds.add(item.id);
  notifyChange();
  return { document, shipmentStatus };
}

export function mockUploadDocument(shipmentId: string, file: File, type: DocumentType): UploadDocumentResult {
  if (!file.name) throw new ApiRequestError("Hãy chọn tệp PDF hoặc ảnh.", 400);
  const document: DocumentRecord = {
    id: `DEMO-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    shipmentId,
    type,
    status: "PROCESSING",
    fileName: file.name,
    version: 1,
    uploadedAt: new Date().toISOString(),
    reviewedAt: null,
  };
  addedDocuments.set(shipmentId, [...(addedDocuments.get(shipmentId) ?? []), document]);
  notifyChange();
  return { document };
}
