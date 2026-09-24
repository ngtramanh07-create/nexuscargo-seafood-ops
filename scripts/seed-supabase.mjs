import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = path.join(root, "data", "shipments.json");
const defaultOrgId = "9c5cd884-947b-4f4b-a679-66dcc0e2b183";
const priorityRank = { CRITICAL: 0, HIGH: 1, NORMAL: 2 };
const urgencyRank = { BLOCKED: 0, AT_RISK: 1, READY: 2, COMPLETED: 3 };
const fixtureAsOf = Date.parse("2026-10-06T02:00:00.000Z");

/** Keep relative deadlines while making the seeded scenarios timely. */
export function shiftFixtureTimestamps(value, days) {
  if (Array.isArray(value)) return value.map((item) => shiftFixtureTimestamps(item, days));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shiftFixtureTimestamps(item, days)]));
  }
  if (typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)) {
    return new Date(Date.parse(value) + days * 86_400_000).toISOString();
  }
  return value;
}

/** Mapping is exported for offline verification without Supabase credentials. */
export function prepareRows(shipments, orgId) {
  if (shipments.length !== 500 || new Set(shipments.map((item) => item.id)).size !== 500) {
    throw new Error("Fixture phải chứa đúng 500 mã lô duy nhất.");
  }
  const prepared = {
    shipments: [], containers: [], documents: [], checks: [], tasks: [], audit_events: [],
  };
  for (const item of shipments) {
    prepared.shipments.push({
      id: item.id,
      org_id: orgId,
      order_no: item.orderNo,
      booking_no: item.bookingNo,
      booking_version: item.bookingVersion,
      product: item.product,
      customer_name: item.customerName,
      destination: item.destination,
      vessel_name: item.vesselName,
      voyage_no: item.voyageNo,
      etd: item.etd,
      si_cutoff: item.cutoffs.si,
      vgm_cutoff: item.cutoffs.vgm,
      cy_cutoff: item.cutoffs.cy,
      status: item.status,
      priority: item.priority,
      urgency_rank: urgencyRank[item.status],
      next_action_at: item.status === "COMPLETED" ? null : item.tasks[0]?.latestStartAt ?? item.cutoffs.si ?? item.etd,
      risk_reasons: item.riskReasons,
      assignee_name: item.assigneeName,
      container_count: item.containerCount,
      required_set_point_celsius: item.requiredSetPointCelsius,
      seafood_profile: item.seafoodProfile ?? null,
      updated_at: item.updatedAt,
    });
    for (const container of item.containers) {
      prepared.containers.push({
        id: container.id,
        shipment_id: item.id,
        container_no: container.containerNo,
        seal_no: container.sealNo,
        set_point_celsius: container.setPointCelsius,
        reefer_connection_confirmed: container.reeferConnectionConfirmed,
        temperature_readings: container.temperatureReadings ?? [],
      });
    }
    for (const document of item.documents) {
      const review = document.status === "PENDING_REVIEW";
      prepared.documents.push({
        id: document.id,
        shipment_id: item.id,
        order_no: item.orderNo,
        type: document.type,
        status: document.status,
        file_name: document.fileName,
        version: document.version,
        review_id: review ? `REV-${document.id}` : null,
        extracted_fields: review
          ? [{
              key: document.type === "SI" ? "sealNo" : "certificateNo",
              label: document.type === "SI" ? "Số seal" : "Số chứng thư",
              suggestedValue: document.type === "SI" ? item.containers[0]?.sealNo ?? null : `HC-${item.id}`,
              confirmedValue: null,
              confidence: document.type === "SI" ? 0.91 : 0.73,
              sourcePage: 1,
              needsReview: true,
            }]
          : [],
        uploaded_at: document.uploadedAt,
        reviewed_at: document.reviewedAt,
      });
    }
    for (const check of item.checks) {
      prepared.checks.push({
        id: `CHK-${item.id}-${check.code}`,
        shipment_id: item.id,
        code: check.code,
        title: check.title,
        status: check.status,
        message: check.message,
        related_document_ids: check.relatedDocumentIds,
        required_by: check.requiredBy,
        updated_at: check.updatedAt,
      });
    }
    for (const task of item.tasks) {
      prepared.tasks.push({
        id: task.id,
        shipment_id: item.id,
        order_no: task.orderNo,
        source_check_code: task.sourceCheckCode,
        title: task.title,
        description: task.description,
        status: task.status,
        status_rank: task.status === "DONE" ? 1 : 0,
        priority: task.priority,
        priority_rank: priorityRank[task.priority],
        assignee_id: task.assigneeId,
        assignee_name: task.assigneeName,
        due_at: task.dueAt,
        latest_start_at: task.latestStartAt,
        evidence_document_id: task.evidenceDocumentId,
        completion_note: task.completionNote,
        version: task.version,
        updated_at: task.updatedAt,
      });
    }
    for (const event of item.auditEvents) {
      prepared.audit_events.push({
        id: event.id,
        shipment_id: item.id,
        actor_name: event.actorName,
        action: event.action,
        description: event.description,
        created_at: event.createdAt,
      });
    }
  }
  return prepared;
}

async function upsertBatches(admin, table, rows, batchSize = 100) {
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const slice = rows.slice(offset, offset + batchSize);
    const { error } = await admin.from(table).upsert(slice, { onConflict: "id" });
    if (error) throw new Error(`${table}, dòng ${offset + 1}–${offset + slice.length}: ${error.message}`);
  }
  console.log(`${table}: ${rows.length}`);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ownerId = process.env.SEED_OWNER_USER_ID;
  const orgId = process.env.SEED_ORG_ID ?? defaultOrgId;
  if (process.env.SEED_CONFIRM !== "seed-nexuscargo-synthetic") {
    throw new Error("Đặt SEED_CONFIRM=seed-nexuscargo-synthetic để xác nhận nạp dữ liệu giả lập.");
  }
  if (!url || !key || !ownerId) {
    throw new Error("Thiếu NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY hoặc SEED_OWNER_USER_ID.");
  }
  if (!/^https:\/\//.test(url) && !/^http:\/\/127\.0\.0\.1(?::\d+)?$/.test(url)) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL phải là HTTPS, hoặc localhost Supabase cục bộ.");
  }
  if (!/^[0-9a-fA-F-]{36}$/.test(ownerId) || !/^[0-9a-fA-F-]{36}$/.test(orgId)) {
    throw new Error("SEED_OWNER_USER_ID và SEED_ORG_ID phải có định dạng UUID.");
  }
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: owner, error: ownerError } = await admin.auth.admin.getUserById(ownerId);
  if (ownerError || !owner.user) throw new Error("SEED_OWNER_USER_ID chưa tồn tại trong Supabase Auth.");
  const shiftDays = Math.round((Date.now() - fixtureAsOf) / 86_400_000);
  const source = shiftFixtureTimestamps(JSON.parse(await readFile(fixturePath, "utf8")), shiftDays);
  console.log(`Dịch toàn bộ mốc giả lập ${shiftDays} ngày để gần ngày nạp dữ liệu.`);
  const rows = prepareRows(source, orgId);
  const { data: existingMembership, error: membershipLookupError } = await admin.from("memberships")
    .select("org_id").eq("user_id", ownerId).maybeSingle();
  if (membershipLookupError) throw new Error(`memberships: ${membershipLookupError.message}`);
  if (existingMembership && existingMembership.org_id !== orgId) {
    throw new Error("Auth user đã thuộc tổ chức khác; không chuyển quyền của tài khoản đó bằng script seed.");
  }
  const { data: existingStaff, error: staffLookupError } = await admin.from("staff")
    .select("id, org_id").in("id", ["USR-001", "USR-002", "USR-003"]);
  if (staffLookupError) throw new Error(`staff: ${staffLookupError.message}`);
  if (existingStaff?.some((record) => record.org_id !== orgId)) {
    throw new Error("Có mã nhân viên trùng ở tổ chức khác; dùng dự án Supabase riêng cho dữ liệu giả lập.");
  }
  let existingSyntheticRows = 0;
  for (let index = 0; index < rows.shipments.length; index += 100) {
    const ids = rows.shipments.slice(index, index + 100).map((item) => item.id);
    const { data: existing, error: collisionError } = await admin.from("shipments")
      .select("id, org_id").in("id", ids);
    if (collisionError) throw new Error(`shipments: ${collisionError.message}`);
    if (existing?.some((record) => record.org_id !== orgId)) {
      throw new Error("Mã lô trùng tổ chức khác; không ghi đè dữ liệu đang vận hành.");
    }
    existingSyntheticRows += existing?.length ?? 0;
  }
  if (existingSyntheticRows > 0) {
    if (process.env.SEED_REPLACE_EXISTING_SYNTHETIC !== "true") {
      throw new Error("Dự án đã có lô giả lập. Để thay bộ mẫu cũ và xóa bản ghi phụ cũ, thêm SEED_REPLACE_EXISTING_SYNTHETIC=true sau khi kiểm tra dữ liệu của mình.");
    }
    const { data: existingOrg, error: orgLookupError } = await admin.from("organizations")
      .select("name").eq("id", orgId).maybeSingle();
    if (orgLookupError || existingOrg?.name !== "NexusCargo Synthetic Workspace") {
      throw new Error("Chỉ được thay bộ dữ liệu trong tổ chức NexusCargo Synthetic Workspace.");
    }
    for (let index = 0; index < rows.shipments.length; index += 100) {
      const ids = rows.shipments.slice(index, index + 100).map((item) => item.id);
      const { error: deleteError } = await admin.from("shipments").delete().eq("org_id", orgId).in("id", ids);
      if (deleteError) throw new Error(`Không thể thay dữ liệu mẫu cũ: ${deleteError.message}`);
    }
    console.log(`Đã thay ${existingSyntheticRows} lô mẫu cũ trong tổ chức giả lập.`);
  }
  const { error: orgError } = await admin.from("organizations").upsert({ id: orgId, name: "NexusCargo Synthetic Workspace" }, { onConflict: "id" });
  if (orgError) throw new Error(`organizations: ${orgError.message}`);
  const { error: memberError } = await admin.from("memberships").upsert({ user_id: ownerId, org_id: orgId, role: "MANAGER" }, { onConflict: "user_id" });
  if (memberError) throw new Error(`memberships: ${memberError.message}`);
  await upsertBatches(admin, "staff", [
    { id: "USR-001", org_id: orgId, display_name: "Bộ phận Chứng từ", role: "DOCUMENT_STAFF" },
    { id: "USR-002", org_id: orgId, display_name: "Bộ phận Vận tải / Hiện trường", role: "OPERATOR" },
    { id: "USR-003", org_id: orgId, display_name: "Bộ phận Kiểm soát chất lượng", role: "OPERATOR" },
  ]);
  for (const table of ["shipments", "containers", "documents", "checks", "tasks", "audit_events"]) {
    await upsertBatches(admin, table, rows[table]);
  }
  const { count, error: countError } = await admin.from("shipments").select("id", { head: true, count: "exact" }).eq("org_id", orgId);
  if (countError || count !== 500) throw new Error(`Kỳ vọng đúng 500 đơn trong tổ chức giả lập, tìm thấy ${count}.`);
  console.log(`Hoàn thành: ${count} đơn và ${rows.containers.length} container giả lập trên Supabase.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(err.message); process.exitCode = 1; });
}
