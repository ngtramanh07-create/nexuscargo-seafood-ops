import type {
  ApiErrorResponse,
  ApiSuccess,
  AssigneeOption,
  DashboardSummary,
  DocumentType,
  Page,
  Product,
  ReviewDecisionRequest,
  ReviewDecisionResult,
  ReviewItem,
  ShipmentDetail,
  ShipmentListItem,
  ShipmentStatus,
  Task,
  TaskStatus,
  UpdateTaskRequest,
  UpdateTaskResult,
  UploadDocumentResult,
} from "@/types/contracts";

export interface ShipmentFilters {
  search: string;
  product: Product | "";
  status: ShipmentStatus | "";
  sort: "urgency" | "etd";
  page: number;
  pageSize: number;
}

export class ApiRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function requestData<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      // API helper runs outside React event handlers; a full navigation clears stale protected views.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    }
    let message = `Không lấy được dữ liệu (HTTP ${response.status}).`;
    try {
      const body = (await response.json()) as ApiErrorResponse;
      if (body.error?.message) message = body.error.message;
    } catch {
      // A may return non-JSON for an unexpected server error.
    }
    throw new ApiRequestError(message, response.status);
  }
  const body = (await response.json()) as ApiSuccess<T>;
  if (body.data === undefined) throw new ApiRequestError("Dữ liệu API chưa đúng định dạng.", response.status);
  return body.data;
}

export function getDashboard(signal?: AbortSignal): Promise<DashboardSummary> {
  return requestData<DashboardSummary>("/api/dashboard", { signal });
}

export function getShipments(filters: ShipmentFilters, signal?: AbortSignal): Promise<Page<ShipmentListItem>> {
  const params = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(filters.pageSize),
    sort: filters.sort,
  });
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.product) params.set("product", filters.product);
  if (filters.status) params.set("status", filters.status);
  return requestData<Page<ShipmentListItem>>(`/api/shipments?${params.toString()}`, { signal });
}

export function getShipment(id: string, signal?: AbortSignal): Promise<ShipmentDetail> {
  return requestData<ShipmentDetail>(`/api/shipments/${encodeURIComponent(id)}`, { signal });
}

export interface TaskFilters {
  status?: TaskStatus | "";
  assigneeId?: string;
  page: number;
  pageSize: number;
}

export function getTasks(filters: TaskFilters, signal?: AbortSignal): Promise<Page<Task>> {
  const params = new URLSearchParams({ page: String(filters.page), pageSize: String(filters.pageSize) });
  if (filters.status) params.set("status", filters.status);
  if (filters.assigneeId) params.set("assigneeId", filters.assigneeId);
  return requestData<Page<Task>>(`/api/tasks?${params.toString()}`, { signal });
}

export function getReview(page = 1, pageSize = 20, signal?: AbortSignal): Promise<Page<ReviewItem>> {
  return requestData<Page<ReviewItem>>(`/api/review?page=${page}&pageSize=${pageSize}`, { signal });
}

export function getAssignees(signal?: AbortSignal): Promise<AssigneeOption[]> {
  return requestData<AssigneeOption[]>("/api/users/assignees", { signal });
}

export function updateTask(taskId: string, payload: UpdateTaskRequest): Promise<UpdateTaskResult> {
  return requestData<UpdateTaskResult>(`/api/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
}

export function reviewDocument(reviewId: string, payload: ReviewDecisionRequest): Promise<ReviewDecisionResult> {
  return requestData<ReviewDecisionResult>(`/api/review/${encodeURIComponent(reviewId)}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
}

export function uploadDocument(shipmentId: string, file: File, type: DocumentType): Promise<UploadDocumentResult> {
  const body = new FormData();
  body.set("file", file);
  body.set("type", type);
  return requestData<UploadDocumentResult>(`/api/shipments/${encodeURIComponent(shipmentId)}/documents`, {
    method: "POST", body,
  });
}
