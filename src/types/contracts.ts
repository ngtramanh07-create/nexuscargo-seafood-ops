/**
 * NexusCargo Seafood Ops — frontend/backend contract v1.1.0 (optional seafood fields).
 * Owner: A. B may import this file but must not change it without agreeing with A.
 * All timestamps are ISO 8601 strings with an explicit UTC offset or Z.
 * Null means that the value has not been supplied or confirmed yet.
 */

export type ISODateTime = string;

export type Product = "SHRIMP" | "PANGASIUS";
export type ShipmentStatus = "READY" | "AT_RISK" | "BLOCKED" | "COMPLETED";
export type Priority = "CRITICAL" | "HIGH" | "NORMAL";
export type CheckStatus = "PASS" | "MISSING" | "MISMATCH" | "PENDING_REVIEW" | "STALE";
export type TaskStatus = "OPEN" | "IN_PROGRESS" | "DONE";
export type DocumentType =
  | "BOOKING"
  | "SI"
  | "VGM"
  | "HEALTH_CERTIFICATE"
  | "CUSTOMS_RELEASE"
  | "GATE_IN_RECEIPT"
  | "OTHER";
export type DocumentStatus =
  | "PROCESSING"
  | "PENDING_REVIEW"
  | "VERIFIED"
  | "STALE"
  | "REJECTED"
  | "FAILED";
export type UserRole = "OPERATOR" | "DOCUMENT_STAFF" | "MANAGER";

export interface Cutoffs {
  si: ISODateTime | null;
  vgm: ISODateTime | null;
  cy: ISODateTime | null;
}

/** A shipment is associated with exactly one synthetic order in v1. */
export interface ShipmentListItem {
  id: string;
  orderNo: string;
  bookingNo: string | null;
  bookingVersion: number;
  product: Product;
  customerName: string;
  destination: string | null;
  vesselName: string | null;
  voyageNo: string | null;
  etd: ISODateTime | null;
  cutoffs: Cutoffs;
  status: ShipmentStatus;
  priority: Priority;
  riskReasons: string[];
  assigneeName: string | null;
  containerCount: number;
  updatedAt: ISODateTime;
}

export interface ContainerRecord {
  id: string;
  containerNo: string | null;
  sealNo: string | null;
  setPointCelsius: number | null;
  reeferConnectionConfirmed: boolean;
  /** RETURN_AIR measures reefer air; CARGO_PROBE is a product probe sample. */
  temperatureReadings?: Array<{
    observedAt: ISODateTime;
    source: "RETURN_AIR" | "CARGO_PROBE";
    celsius: number;
    sensorId: string;
  }>;
}

/** All thresholds here are synthetic booking/buyer requirements, not laws. */
export interface SeafoodProfile {
  product: Product;
  marketCode: "JP" | "KR" | "EU" | "US";
  productForm: string;
  sizeGrade: string;
  packaging: string;
  netWeightKg: number;
  lotCode: string | null;
  packingListLotCode: string | null;
  productionDate: string;
  factoryCode: string;
  factoryName: string;
  factoryApprovalRef: string | null;
  glazePercent: number | null;
  customerSpec: {
    maxCargoTempCelsius: number;
    maxProbeAgeHours: number;
    requiredTests: Array<"RESIDUE" | "SULFITE" | "MICROBIOLOGY">;
    requiresFactoryApprovalEvidence: boolean;
    requiresHealthCertificate: boolean;
    maxGlazePercent: number | null;
  };
  labResults: Array<{
    kind: "RESIDUE" | "SULFITE" | "MICROBIOLOGY";
    testedLotCode: string;
    status: "PASS" | "PENDING" | "FAIL";
    reportNo: string;
  }>;
}

export interface DocumentRecord {
  id: string;
  shipmentId: string;
  type: DocumentType;
  status: DocumentStatus;
  fileName: string;
  version: number;
  uploadedAt: ISODateTime;
  reviewedAt: ISODateTime | null;
}

export interface CheckResult {
  code: string;
  title: string;
  status: CheckStatus;
  message: string;
  relatedDocumentIds: string[];
  requiredBy: ISODateTime | null;
  updatedAt: ISODateTime;
}

export interface Task {
  id: string;
  shipmentId: string;
  orderNo: string;
  sourceCheckCode: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assigneeId: string | null;
  /** Display label of the handling department; legacy key kept for API compatibility. */
  assigneeName: string | null;
  dueAt: ISODateTime | null;
  latestStartAt: ISODateTime | null;
  evidenceDocumentId: string | null;
  completionNote: string | null;
  version: number;
  updatedAt: ISODateTime;
}

export interface AuditEvent {
  id: string;
  actorName: string;
  action: string;
  description: string;
  createdAt: ISODateTime;
}

export interface ShipmentDetail extends ShipmentListItem {
  /** Seal recorded on the latest SI, separately from the physical container seal. */
  siSealNo?: string | null;
  /** Temperature required by the latest confirmed booking instruction. */
  requiredSetPointCelsius: number | null;
  /** Optional addition: existing B clients can keep their v1 renderer unchanged. */
  seafoodProfile?: SeafoodProfile | null;
  containers: ContainerRecord[];
  documents: DocumentRecord[];
  checks: CheckResult[];
  tasks: Task[];
  auditEvents: AuditEvent[];
}

export interface StatusCounts {
  READY: number;
  AT_RISK: number;
  BLOCKED: number;
  COMPLETED: number;
}

export interface DashboardSummary {
  totalOrders: number;
  statusCounts: StatusCounts;
  /** Unfinished tasks whose latestStartAt is within the next 24 hours. */
  tasksDueSoon: number;
  urgentTasks: Task[];
  asOf: ISODateTime;
}

/** Numeric confidence in the inclusive interval [0, 1]; null if unavailable. */
export interface ExtractedField {
  key: string;
  label: string;
  suggestedValue: string | null;
  confirmedValue: string | null;
  confidence: number | null;
  sourcePage: number | null;
  needsReview: boolean;
}

export interface ReviewItem {
  id: string;
  shipmentId: string;
  orderNo: string;
  document: DocumentRecord;
  fields: ExtractedField[];
  createdAt: ISODateTime;
}

export interface AssigneeOption {
  id: string;
  name: string;
  role: UserRole;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ApiSuccess<T> {
  data: T;
}

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "FILE_TOO_LARGE"
  | "UNPROCESSABLE_DOCUMENT"
  | "AI_UNAVAILABLE"
  | "INTERNAL_ERROR";

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, string>;
  };
}

/** expectedVersion prevents overwriting a task edited by another employee. */
export type UpdateTaskRequest =
  | { action: "ASSIGN"; expectedVersion: number; assigneeId: string }
  | { action: "START"; expectedVersion: number }
  | {
      action: "COMPLETE";
      expectedVersion: number;
      evidenceDocumentId: string;
      note?: string;
    };

export interface UpdateTaskResult {
  task: Task;
  shipmentStatus: ShipmentStatus;
}

export type ReviewDecisionRequest =
  | {
      decision: "APPROVE";
      corrections: Array<{ key: string; confirmedValue: string }>;
    }
  | { decision: "REJECT"; note: string };

export interface ReviewDecisionResult {
  document: DocumentRecord;
  shipmentStatus: ShipmentStatus;
}

export interface UploadDocumentResult {
  document: DocumentRecord;
}
