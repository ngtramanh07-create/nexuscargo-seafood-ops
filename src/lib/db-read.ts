import type { SupabaseClient } from "@supabase/supabase-js";
import { error, ok, pagination } from "@/lib/api-fixture";
import { hasSupabaseConfig } from "@/lib/data-source";
import { createUserClient } from "@/lib/supabase/server";
import type {
  AssigneeOption, AuditEvent, CheckResult, ContainerRecord,
  DocumentRecord, ExtractedField, Page, Product, ReviewItem,
  ShipmentDetail, ShipmentListItem, ShipmentStatus, Task, TaskStatus,
  SeafoodProfile,
} from "@/types/contracts";

type ShipmentRow = {
  id: string; order_no: string; booking_no: string | null; booking_version: number;
  product: Product; customer_name: string; destination: string | null;
  vessel_name: string | null; voyage_no: string | null; etd: string | null;
  si_cutoff: string | null; vgm_cutoff: string | null; cy_cutoff: string | null;
  status: ShipmentStatus; priority: ShipmentListItem["priority"]; risk_reasons: string[];
  assignee_name: string | null; container_count: number;
  required_set_point_celsius: number | null; seafood_profile: SeafoodProfile | null; updated_at: string;
};
type ContainerRow = {
  id: string; container_no: string | null; seal_no: string | null;
  set_point_celsius: number | null; reefer_connection_confirmed: boolean;
  temperature_readings: NonNullable<ContainerRecord["temperatureReadings"]>;
};
type DocumentRow = {
  id: string; shipment_id: string; type: DocumentRecord["type"];
  status: DocumentRecord["status"]; file_name: string; version: number;
  uploaded_at: string; reviewed_at: string | null; order_no: string;
  review_id: string | null; extracted_fields: ExtractedField[];
};
type CheckRow = {
  code: string; title: string; status: CheckResult["status"]; message: string;
  related_document_ids: string[]; required_by: string | null; updated_at: string;
};
type TaskRow = {
  id: string; shipment_id: string; order_no: string; source_check_code: string;
  title: string; description: string; status: TaskStatus; priority: Task["priority"];
  assignee_id: string | null; assignee_name: string | null;
  due_at: string | null; latest_start_at: string | null;
  evidence_document_id: string | null; completion_note: string | null;
  version: number; updated_at: string;
};
type EventRow = { id: string; actor_name: string; action: string; description: string; created_at: string };
type StaffRow = { id: string; display_name: string; role: AssigneeOption["role"] };

function listItem(row: ShipmentRow): ShipmentListItem {
  return {
    id: row.id, orderNo: row.order_no, bookingNo: row.booking_no,
    bookingVersion: row.booking_version, product: row.product,
    customerName: row.customer_name, destination: row.destination,
    vesselName: row.vessel_name, voyageNo: row.voyage_no, etd: row.etd,
    cutoffs: { si: row.si_cutoff, vgm: row.vgm_cutoff, cy: row.cy_cutoff },
    status: row.status, priority: row.priority, riskReasons: row.risk_reasons,
    assigneeName: row.assignee_name, containerCount: row.container_count,
    updatedAt: row.updated_at,
  };
}
function container(row: ContainerRow): ContainerRecord {
  return { id: row.id, containerNo: row.container_no, sealNo: row.seal_no,
    setPointCelsius: row.set_point_celsius, reeferConnectionConfirmed: row.reefer_connection_confirmed,
    temperatureReadings: row.temperature_readings ?? [] };
}
function document(row: DocumentRow): DocumentRecord {
  return { id: row.id, shipmentId: row.shipment_id, type: row.type,
    status: row.status, fileName: row.file_name, version: row.version,
    uploadedAt: row.uploaded_at, reviewedAt: row.reviewed_at };
}
function check(row: CheckRow): CheckResult {
  return { code: row.code, title: row.title, status: row.status,
    message: row.message, relatedDocumentIds: row.related_document_ids,
    requiredBy: row.required_by, updatedAt: row.updated_at };
}
function task(row: TaskRow): Task {
  return { id: row.id, shipmentId: row.shipment_id, orderNo: row.order_no,
    sourceCheckCode: row.source_check_code, title: row.title, description: row.description,
    status: row.status, priority: row.priority, assigneeId: row.assignee_id,
    assigneeName: row.assignee_name, dueAt: row.due_at, latestStartAt: row.latest_start_at,
    evidenceDocumentId: row.evidence_document_id, completionNote: row.completion_note,
    version: row.version, updatedAt: row.updated_at };
}
function event(row: EventRow): AuditEvent {
  return { id: row.id, actorName: row.actor_name, action: row.action,
    description: row.description, createdAt: row.created_at };
}

type DbContext = { db: SupabaseClient; orgId: string };
type DbResult = DbContext | Response;

export async function requireReader(): Promise<DbResult> {
  if (!hasSupabaseConfig()) return error("INTERNAL_ERROR", "Supabase chưa được cấu hình.", 503);
  try {
    const db = await createUserClient();
    // Always verify against Supabase Auth; never authorize from an unverified cookie.
    const { data: userData, error: authError } = await db.auth.getUser();
    if (authError || !userData.user) return error("UNAUTHENTICATED", "Vui lòng đăng nhập.", 401);
    const { data: member, error: memberError } = await db.from("memberships")
      .select("org_id").eq("user_id", userData.user.id).maybeSingle();
    if (memberError) return databaseError(memberError);
    if (!member) return error("FORBIDDEN", "Tài khoản chưa được phân vào tổ chức.", 403);
    return { db, orgId: member.org_id as string };
  } catch (cause) {
    return databaseError(cause);
  }
}

function databaseError(cause: unknown): Response {
  console.error("NexusCargo database read error:", cause);
  return error("INTERNAL_ERROR", "Không tải được dữ liệu. Vui lòng thử lại.", 500);
}
function page<T>(items: T[], total: number | null, pageNo: number, pageSize: number): Page<T> {
  return { items, page: pageNo, pageSize, total: total ?? 0 };
}

export async function dbDashboard(): Promise<Response> {
  const context = await requireReader();
  if (context instanceof Response) return context;
  const { db, orgId } = context;
  const statuses: ShipmentStatus[] = ["READY", "AT_RISK", "BLOCKED", "COMPLETED"];
  const asOf = new Date().toISOString();
  const horizon = new Date(Date.parse(asOf) + 24 * 60 * 60 * 1000).toISOString();
  const [counts, due, urgent] = await Promise.all([
    Promise.all(statuses.map((status) => db.from("shipments").select("id", { head: true, count: "exact" }).eq("org_id", orgId).eq("status", status))),
    db.from("tasks").select("id", { head: true, count: "exact" }).neq("status", "DONE").gte("latest_start_at", asOf).lte("latest_start_at", horizon),
    db.from("tasks").select("*").neq("status", "DONE").lte("latest_start_at", horizon)
      .order("latest_start_at").order("priority_rank").order("id").limit(5),
  ]);
  if (counts.some((result) => result.error) || due.error || urgent.error) return databaseError(counts.find((result) => result.error)?.error ?? due.error ?? urgent.error);
  const statusCounts = {
    READY: counts[0].count ?? 0, AT_RISK: counts[1].count ?? 0,
    BLOCKED: counts[2].count ?? 0, COMPLETED: counts[3].count ?? 0,
  };
  return ok({
    totalOrders: Object.values(statusCounts).reduce((sum, n) => sum + n, 0),
    statusCounts, tasksDueSoon: due.count ?? 0,
    urgentTasks: ((urgent.data ?? []) as TaskRow[]).map(task), asOf,
  });
}

export async function dbShipments(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = pagination(url);
  if (parsed instanceof Response) return parsed;
  const product = url.searchParams.get("product");
  const status = url.searchParams.get("status");
  const sort = url.searchParams.get("sort") ?? "urgency";
  const search = (url.searchParams.get("search") ?? "").trim();
  if (product && product !== "SHRIMP" && product !== "PANGASIUS") return error("VALIDATION_ERROR", "product không hợp lệ.", 400);
  if (status && !["READY", "AT_RISK", "BLOCKED", "COMPLETED"].includes(status)) return error("VALIDATION_ERROR", "status không hợp lệ.", 400);
  if (sort !== "urgency" && sort !== "etd") return error("VALIDATION_ERROR", "sort không hợp lệ.", 400);
  if (search && !/^[\p{L}\p{N}_-]{1,60}$/u.test(search)) return error("VALIDATION_ERROR", "search chỉ nhận mã đơn hoặc booking tối đa 60 ký tự.", 400);
  const context = await requireReader();
  if (context instanceof Response) return context;
  let query = context.db.from("shipments").select("*", { count: "exact" }).eq("org_id", context.orgId);
  if (product) query = query.eq("product", product);
  if (status) query = query.eq("status", status);
  if (search) query = query.or(`order_no.ilike.%${search}%,booking_no.ilike.%${search}%`);
  query = sort === "etd"
    ? query.order("etd", { nullsFirst: false }).order("id")
    : query.order("urgency_rank").order("next_action_at", { nullsFirst: false }).order("id");
  const { data, count, error: dbErr } = await query.range((parsed.page - 1) * parsed.pageSize, parsed.page * parsed.pageSize - 1);
  if (dbErr) return databaseError(dbErr);
  return ok(page(((data ?? []) as ShipmentRow[]).map(listItem), count, parsed.page, parsed.pageSize));
}

export async function dbShipmentDetail(shipmentId: string): Promise<Response> {
  const context = await requireReader();
  if (context instanceof Response) return context;
  const { db, orgId } = context;
  const { data: found, error: foundError } = await db.from("shipments").select("*").eq("org_id", orgId).eq("id", shipmentId).maybeSingle();
  if (foundError) return databaseError(foundError);
  if (!found) return error("NOT_FOUND", "Không tìm thấy lô hàng.", 404);
  const [containers, documents, checks, tasks, events] = await Promise.all([
    db.from("containers").select("*").eq("shipment_id", shipmentId).order("id"),
    db.from("documents").select("*").eq("shipment_id", shipmentId).order("uploaded_at"),
    db.from("checks").select("*").eq("shipment_id", shipmentId).order("code"),
    db.from("tasks").select("*").eq("shipment_id", shipmentId).order("priority_rank").order("id"),
    db.from("audit_events").select("*").eq("shipment_id", shipmentId).order("created_at", { ascending: false }),
  ]);
  const failure = [containers, documents, checks, tasks, events].find((result) => result.error);
  if (failure?.error) return databaseError(failure.error);
  const row = found as ShipmentRow;
  const detail: ShipmentDetail = {
    ...listItem(row), requiredSetPointCelsius: row.required_set_point_celsius,
    seafoodProfile: row.seafood_profile,
    containers: ((containers.data ?? []) as ContainerRow[]).map(container),
    documents: ((documents.data ?? []) as DocumentRow[]).map(document),
    checks: ((checks.data ?? []) as CheckRow[]).map(check),
    tasks: ((tasks.data ?? []) as TaskRow[]).map(task),
    auditEvents: ((events.data ?? []) as EventRow[]).map(event),
  };
  return ok(detail);
}

export async function dbTasks(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = pagination(url);
  if (parsed instanceof Response) return parsed;
  const status = url.searchParams.get("status");
  const assigneeId = url.searchParams.get("assigneeId");
  if (status && !["OPEN", "IN_PROGRESS", "DONE"].includes(status)) return error("VALIDATION_ERROR", "status không hợp lệ.", 400);
  const context = await requireReader();
  if (context instanceof Response) return context;
  let query = context.db.from("tasks").select("*", { count: "exact" });
  if (status) query = query.eq("status", status);
  if (assigneeId) query = query.eq("assignee_id", assigneeId);
  const { data, count, error: dbErr } = await query.order("status_rank")
    .order("latest_start_at", { nullsFirst: false }).order("priority_rank").order("id")
    .range((parsed.page - 1) * parsed.pageSize, parsed.page * parsed.pageSize - 1);
  if (dbErr) return databaseError(dbErr);
  return ok(page(((data ?? []) as TaskRow[]).map(task), count, parsed.page, parsed.pageSize));
}

export async function dbReviews(request: Request): Promise<Response> {
  const parsed = pagination(new URL(request.url));
  if (parsed instanceof Response) return parsed;
  const context = await requireReader();
  if (context instanceof Response) return context;
  const { data, count, error: dbErr } = await context.db.from("documents").select("*", { count: "exact" })
    .eq("status", "PENDING_REVIEW").order("uploaded_at").order("id")
    .range((parsed.page - 1) * parsed.pageSize, parsed.page * parsed.pageSize - 1);
  if (dbErr) return databaseError(dbErr);
  const items: ReviewItem[] = ((data ?? []) as DocumentRow[]).map((row) => ({
    id: row.review_id ?? `REV-${row.id}`, shipmentId: row.shipment_id,
    orderNo: row.order_no, document: document(row),
    fields: row.extracted_fields, createdAt: row.uploaded_at,
  }));
  return ok(page(items, count, parsed.page, parsed.pageSize));
}

export async function dbAssignees(): Promise<Response> {
  const context = await requireReader();
  if (context instanceof Response) return context;
  const { data, error: dbErr } = await context.db.from("staff").select("id, display_name, role")
    .eq("org_id", context.orgId).order("display_name");
  if (dbErr) return databaseError(dbErr);
  const result: AssigneeOption[] = ((data ?? []) as StaffRow[]).map((row) => ({ id: row.id, name: row.display_name, role: row.role }));
  return ok(result);
}
