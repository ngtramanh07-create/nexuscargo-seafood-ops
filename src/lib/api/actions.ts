import { reviewDocument, updateTask } from "@/lib/api/client";
import { mockReviewDecision, mockUpdateTask, mockUploadDocument } from "@/lib/api/mock";
import type {
  AssigneeOption, DocumentRecord, DocumentType, ReviewDecisionRequest, ReviewDecisionResult, ReviewItem,
  ShipmentStatus, Task, UpdateTaskRequest, UpdateTaskResult, UploadDocumentResult,
} from "@/types/contracts";

/** Public demo changes are browser previews; no database or fixture writes. */
export const isMockWriteMode = process.env.NEXT_PUBLIC_NEXUSCARGO_PUBLIC_DEMO === "true";

export async function performTaskUpdate(
  task: Task, payload: UpdateTaskRequest, assignees: AssigneeOption[], documents: DocumentRecord[], shipmentStatus: ShipmentStatus,
): Promise<UpdateTaskResult> {
  return isMockWriteMode
    ? mockUpdateTask(task, payload, assignees, documents, shipmentStatus)
    : updateTask(task.id, payload);
}

export async function performReviewDecision(
  item: ReviewItem, payload: ReviewDecisionRequest, shipmentStatus: ShipmentStatus,
): Promise<ReviewDecisionResult> {
  return isMockWriteMode ? mockReviewDecision(item, payload, shipmentStatus) : reviewDocument(item.id, payload);
}

export async function performUpload(shipmentId: string, file: File, type: DocumentType): Promise<UploadDocumentResult> {
  return mockUploadDocument(shipmentId, file, type);
}
