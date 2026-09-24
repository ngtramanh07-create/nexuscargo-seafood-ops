import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { evaluateSeafoodChecks } from "./seafood-rules.mjs";

// Stable teaching fixture. These dates, customers and companies are fictional.
// A will replace this file-backed development source with Supabase persistence.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const snapshot = Date.parse("2026-10-06T02:00:00.000Z"); // 09:00 in Vietnam
const hour = 60 * 60 * 1000;
const day = 24 * hour;
// Estimated work + contingency from the cutoff, in hours; synthetic SLA assumptions.
const preparationHours = { SEAL_SI_MATCH: 3, SI_CONFIRMED: 2, VGM_CONFIRMED: 5,
  CERT_CONFIRMED: 8, REEFER_SETPOINT: 3, LOT_TRACE: 4, FACTORY_EVIDENCE: 12,
  PRODUCT_SPEC: 6, LAB_RESIDUE: 24, LAB_SULFITE: 20, LAB_MICROBIOLOGY: 24, CARGO_TEMP: 4 };
const bufferHours = { LAB_RESIDUE: 8, LAB_SULFITE: 8, LAB_MICROBIOLOGY: 8,
  FACTORY_EVIDENCE: 6, CERT_CONFIRMED: 4, VGM_CONFIRMED: 2 };
const leadHours = (code) => (preparationHours[code] ?? 4) + (bufferHours[code] ?? 1);
const iso = (time) => new Date(time).toISOString();
const pad = (number, length = 4) => String(number).padStart(length, "0");

const customers = [
  "Công ty Thủy sản Minh Hải (giả lập)",
  "Công ty Chế biến Biển Xanh (giả lập)",
  "Công ty Thực phẩm Mekong (giả lập)",
  "Công ty Xuất khẩu Nam Việt (giả lập)",
];
const destinations = [
  "Yokohama, Nhật Bản",
  "Busan, Hàn Quốc",
  "Rotterdam, Hà Lan",
  "Los Angeles, Hoa Kỳ",
];
const markets = ["JP", "KR", "EU", "US"];
const factories = [
  { code: "VN-SF-101", name: "Nhà máy thủy sản A (giả lập)" },
  { code: "VN-SF-205", name: "Nhà máy thủy sản B (giả lập)" },
  { code: "VN-SF-307", name: "Nhà máy thủy sản C (giả lập)" },
  { code: "VN-SF-412", name: "Nhà máy thủy sản D (giả lập)" },
];
// Nhóm xử lý của forwarder / nhà xuất khẩu, không phải tên cá nhân.
const departments = {
  DOCUMENTS: { id: "USR-001", name: "Bộ phận Chứng từ" },
  TRANSPORT: { id: "USR-002", name: "Bộ phận Vận tải / Hiện trường" },
  QUALITY: { id: "USR-003", name: "Bộ phận Kiểm soát chất lượng" },
};
function departmentFor(code) {
  if (["REEFER_SETPOINT", "VGM_CONFIRMED"].includes(code)) return departments.TRANSPORT;
  if (["PRODUCT_SPEC", "LAB_RESIDUE", "LAB_SULFITE", "LAB_MICROBIOLOGY", "CARGO_TEMP"].includes(code)) return departments.QUALITY;
  return departments.DOCUMENTS;
}

function check(code, title, status, message, requiredBy, relatedDocumentIds = []) {
  return { code, title, status, message, relatedDocumentIds, requiredBy, updatedAt: iso(snapshot - hour / 4) };
}

function shipment(index) {
  const serial = index + 1;
  const suffix = pad(serial);
  const shipmentId = `SHP-${suffix}`;
  const orderNo = `EXP-2026-${suffix}`;
  const product = index < 250 ? "SHRIMP" : "PANGASIUS";
  // 17 core causes, plus independent overlaps and varied market/product inputs.
  const scenario = index % 17;
  const completed = scenario >= 7 && scenario <= 9;
  // Some unresolved orders intentionally missed yesterday's cutoff.
  const dayOffset = serial % 53 === 0 ? -1 : Math.floor((index % 250) / 17);
  const siCutoff = snapshot + dayOffset * day + (6 + index % 4) * hour;
  const vgmCutoff = siCutoff + (17 + index % 5) * hour;
  const cyCutoff = siCutoff + (23 + index % 6) * hour;
  const etd = cyCutoff + (10 + index % 4) * hour;
  const marketCode = scenario === 16 ? "EU" : markets[Math.floor(index / 5) % markets.length];
  const marketDestination = { JP: destinations[0], KR: destinations[1], EU: destinations[2], US: destinations[3] };
  const sealNo = `SL-${pad(serial, 6)}`;
  const baseDocument = {
    id: `DOC-BK-${suffix}`,
    shipmentId,
    type: "BOOKING",
    status: "VERIFIED",
    fileName: `booking-${suffix}.pdf`,
    version: 2,
    uploadedAt: iso(snapshot - 2 * day),
    reviewedAt: iso(snapshot - day),
  };
  const documents = [baseDocument];
  const containers = [
    {
      id: `CTR-${suffix}-1`,
      containerNo: `MSCU${String(1234560 + serial).slice(-7)}`,
      sealNo,
      setPointCelsius: -18,
      reeferConnectionConfirmed: scenario !== 6,
      temperatureReadings: [],
    },
  ];
  if (index % 10 === 0) {
    containers.push({
      id: `CTR-${suffix}-2`,
      containerNo: `TGHU${String(2468010 + serial).slice(-7)}`,
      sealNo: `SL-${pad(serial + 900, 6)}`,
      setPointCelsius: -18,
      reeferConnectionConfirmed: true,
      temperatureReadings: [],
    });
  }

  for (const container of containers) {
    for (let step = 0; step < 6; step++) {
      const observedAt = iso(snapshot - (6 - step) * hour);
      const usual = -18.7 + ((serial + step * 3) % 6) * 0.15;
      container.temperatureReadings.push({ observedAt, source: "RETURN_AIR", celsius: Number((usual - 0.2).toFixed(1)), sensorId: `${container.id}-RETURN` });
      if (scenario !== 15) container.temperatureReadings.push({ observedAt, source: "CARGO_PROBE", celsius: Number((usual + (scenario === 14 && step === 4 ? 5 : 0) + (!completed && serial % 43 === 0 && step === 3 ? 4 : 0)).toFixed(1)), sensorId: `${container.id}-PROBE` });
    }
  }
  const factory = factories[Math.floor(index / 7) % factories.length];
  const lotCode = scenario === 11 && serial % 2 === 0 ? null : `LOT-${2026}-${pad(Math.floor(index / 3) + 1)}`;
  const requiredTests = ["RESIDUE", ...(product === "SHRIMP" && marketCode === "US" ? ["SULFITE"] : []), ...(marketCode === "JP" ? ["MICROBIOLOGY"] : [])];
  if (scenario === 10 && product === "SHRIMP" && !requiredTests.includes("SULFITE")) requiredTests.push("SULFITE");
  const seafoodProfile = {
    product, marketCode, productForm: product === "SHRIMP" ? ["Tôm bóc vỏ", "Tôm nguyên con", "Tôm bỏ đầu"][serial % 3] : ["Cá tra phi lê", "Cá tra cắt khúc"][serial % 2],
    sizeGrade: product === "SHRIMP" ? ["21/25", "26/30", "31/40", "41/50"][serial % 4] : ["170–220 g/miếng", "220–300 g/miếng", "300–400 g/miếng"][serial % 3],
    packaging: ["IQF 1 kg × 10", "Block 10 kg", "IQF 2 kg × 5"][serial % 3],
    netWeightKg: 17_000 + (serial % 15) * 310,
    lotCode, packingListLotCode: scenario === 11 && lotCode ? `LOT-OLD-${suffix}` : lotCode,
    productionDate: iso(snapshot - (9 + serial % 15) * day).slice(0, 10),
    factoryCode: factory.code, factoryName: factory.name,
    factoryApprovalRef: scenario === 16 ? null : `DEMO-${factory.code}`,
    glazePercent: product === "PANGASIUS" ? scenario === 10 ? 25 : 10 + serial % 7 : null,
    customerSpec: {
      // These are fictional BUYER/BOOKING conditions; do not treat them as legal limits.
      maxCargoTempCelsius: -17, maxProbeAgeHours: 6,
      requiredTests, requiresFactoryApprovalEvidence: marketCode === "EU",
      requiresHealthCertificate: marketCode === "EU" || serial % 3 === 0,
      maxGlazePercent: product === "PANGASIUS" ? 20 : null,
    },
    labResults: requiredTests.map((kind) => ({ kind, testedLotCode: lotCode ?? `LOT-MISSING-${suffix}`,
      status: scenario === 13 && kind === "RESIDUE" ? "FAIL" : scenario === 12 && kind === "RESIDUE" || scenario === 10 && product === "SHRIMP" && kind === "SULFITE" ? "PENDING" : "PASS",
      reportNo: `DEMO-LAB-${kind}-${suffix}` })),
  };

  if (scenario === 2 || scenario === 4 || scenario === 5) {
    documents.push({
      id: `DOC-${suffix}-1`,
      shipmentId,
      type: scenario === 4 ? "HEALTH_CERTIFICATE" : "SI",
      status: scenario === 5 ? "VERIFIED" : "PENDING_REVIEW",
      fileName: scenario === 4 ? `health-certificate-${suffix}.pdf` : `si-${suffix}.pdf`,
      version: 1,
      uploadedAt: iso(snapshot - hour),
      reviewedAt: scenario === 5 ? iso(snapshot - hour / 2) : null,
    });
  }
  for (const [type, code, omitted] of [
    ["SI", "SI", scenario === 2 || scenario === 5],
    ["VGM", "VGM", scenario === 3],
    ["HEALTH_CERTIFICATE", "CERT", scenario === 4],
  ]) {
    if (omitted) continue;
    documents.push({
      id: `DOC-${suffix}-${code}`,
      shipmentId,
      type,
      status: "VERIFIED",
      fileName: `${code.toLowerCase()}-${suffix}.pdf`,
      version: 1,
      uploadedAt: iso(snapshot - 2 * day),
      reviewedAt: iso(snapshot - day),
    });
  }
  if (completed) {
    documents.push({
      id: `DOC-${suffix}-GATE`,
      shipmentId,
      type: "GATE_IN_RECEIPT",
      status: "VERIFIED",
      fileName: `gate-in-${suffix}.pdf`,
      version: 1,
      uploadedAt: iso(snapshot - 3 * hour),
      reviewedAt: iso(snapshot - 2 * hour),
    });
  }

  const checks = [
    check("BOOKING_CONFIRMED", "Booking đã xác nhận", "PASS", "Đã xác nhận booking phiên bản 2.", iso(siCutoff)),
    check("REEFER_SETPOINT", "Nhiệt độ và kết nối container lạnh", "PASS", "Đã xác nhận nhiệt độ -18°C và kết nối điện.", iso(cyCutoff)),
    check("SEAL_SI_MATCH", "Đối chiếu seal và SI", "PASS", "Thông tin seal khớp SI.", iso(siCutoff)),
    check("SI_CONFIRMED", "Xác nhận Shipping Instruction", "PASS", "SI đã được đối chiếu.", iso(siCutoff)),
    check("VGM_CONFIRMED", "Xác nhận VGM", "PASS", "VGM đã được xác nhận.", iso(vgmCutoff)),
    check("CERT_CONFIRMED", "Xác nhận chứng thư theo yêu cầu lô", "PASS", "Đã xác nhận chứng từ theo cấu hình lô.", iso(siCutoff)),
  ];
  const update = (code, newStatus, message, relatedDocumentIds = []) => {
    const item = checks.find((entry) => entry.code === code);
    item.status = newStatus;
    item.message = message;
    item.relatedDocumentIds = relatedDocumentIds;
  };
  if (scenario === 2) update("SI_CONFIRMED", "PENDING_REVIEW", "AI trích xuất SI; nhân viên cần xác nhận dữ liệu.", [`DOC-${suffix}-1`]);
  if (scenario === 3) update("VGM_CONFIRMED", "MISSING", "Chưa có VGM đã xác nhận.");
  if (scenario === 4) update("CERT_CONFIRMED", "PENDING_REVIEW", "Chứng thư chờ đối chiếu với yêu cầu của lô.", [`DOC-${suffix}-1`]);
  if (scenario === 5) update("SEAL_SI_MATCH", "MISMATCH", `SI ghi seal SL-OLD-${suffix}; container đã xác nhận ${sealNo}.`, [`DOC-${suffix}-1`]);
  if (scenario === 6) update("REEFER_SETPOINT", "MISMATCH", "Chưa có xác nhận container lạnh đã kết nối điện tại bãi.");

  if (!seafoodProfile.customerSpec.requiresHealthCertificate) {
    const certIndex = checks.findIndex((item) => item.code === "CERT_CONFIRMED");
    checks.splice(certIndex, 1);
    const docIndex = documents.findIndex((item) => item.type === "HEALTH_CERTIFICATE");
    if (docIndex !== -1) documents.splice(docIndex, 1);
  }
  if (!completed && serial % 41 === 0) update("SI_CONFIRMED", "STALE", "Booking phiên bản mới: SI cần đối chiếu lại trước cutoff.");
  checks.push(...evaluateSeafoodChecks(seafoodProfile, containers, snapshot, iso(cyCutoff)));

  const blockers = checks.filter((item) => item.status !== "PASS");
  const blockingCodes = new Set(["LOT_TRACE", "LAB_RESIDUE", "CARGO_TEMP"]);
  const status = completed && blockers.length === 0
    ? "COMPLETED"
    : blockers.some((item) => item.status === "MISMATCH" || item.status === "MISSING" && blockingCodes.has(item.code))
      ? "BLOCKED"
      : blockers.length > 0
        ? "AT_RISK"
        : "READY";
  const priority = status === "BLOCKED" ? "CRITICAL" : status === "AT_RISK" ? "HIGH" : "NORMAL";
  const tasks = blockers.map((item) => ({
    id: `TASK-${suffix}-${item.code}`,
    shipmentId,
    orderNo,
    sourceCheckCode: item.code,
    title: {
      SI_CONFIRMED: "Xác nhận dữ liệu SI",
      VGM_CONFIRMED: "Bổ sung VGM",
      CERT_CONFIRMED: "Kiểm tra chứng thư",
      SEAL_SI_MATCH: "Cập nhật seal trên SI",
      REEFER_SETPOINT: "Xác nhận kết nối container lạnh",
      LOT_TRACE: "Đối chiếu mã lô trên packing list",
      FACTORY_EVIDENCE: "Bổ sung hồ sơ nhà máy",
      PRODUCT_SPEC: "Đối chiếu quy cách theo hợp đồng",
      LAB_RESIDUE: "Kiểm tra kết quả dư lượng theo lô",
      LAB_SULFITE: "Xác nhận hồ sơ sulfite của tôm",
      LAB_MICROBIOLOGY: "Kiểm tra phiếu vi sinh",
      CARGO_TEMP: "Kiểm tra đầu dò nhiệt độ hàng",
    }[item.code] ?? item.title,
    description: item.message,
    status: serial % 4 === 0 ? "IN_PROGRESS" : "OPEN",
    priority,
    assigneeId: departmentFor(item.code).id,
    assigneeName: departmentFor(item.code).name,
    dueAt: item.requiredBy,
    latestStartAt: item.requiredBy ? iso(Date.parse(item.requiredBy) - leadHours(item.code) * hour) : null,
    evidenceDocumentId: null,
    completionNote: null,
    version: serial % 4 === 0 ? 2 : 1,
    updatedAt: iso(snapshot - (serial % 4 === 0 ? hour / 6 : hour / 4)),
  }));
  // A resolved historical SI task proves the DONE tab uses genuine seeded rows.
  // The corresponding check is PASS and the supporting SI metadata is VERIFIED.
  if (!blockers.length && (completed || scenario === 0 || scenario === 1)) {
    const evidence = documents.find((document) => document.type === "SI" && document.status === "VERIFIED");
    if (evidence) tasks.push({
      id: `TASK-${suffix}-SI_HISTORY`, shipmentId, orderNo,
      sourceCheckCode: "SI_CONFIRMED", title: "Đã đối chiếu và xác nhận SI",
      description: "Bộ phận Chứng từ đã đối chiếu SI với booking và xác nhận trước hạn.",
      status: "DONE", priority: "NORMAL",
      assigneeId: departments.DOCUMENTS.id, assigneeName: departments.DOCUMENTS.name,
      dueAt: iso(siCutoff), latestStartAt: iso(siCutoff - leadHours("SI_CONFIRMED") * hour),
      evidenceDocumentId: evidence.id,
      completionNote: "Đã đối chiếu với booking; chứng từ mẫu đã xác nhận.",
      version: 2, updatedAt: iso(snapshot - hour / 2),
    });
  }

  return {
    id: shipmentId,
    orderNo,
    bookingNo: `BK-SF-${suffix}`,
    bookingVersion: 2,
    product,
    customerName: customers[index % customers.length],
    destination: marketDestination[marketCode],
    vesselName: `Ocean Star ${Math.floor(index / 60) + 1}`,
    voyageNo: `OS${String(100 + Math.floor(index / 60))}`,
    etd: iso(etd),
    cutoffs: { si: iso(siCutoff), vgm: iso(vgmCutoff), cy: iso(cyCutoff) },
    status,
    priority,
    riskReasons: blockers.map((item) => item.message),
    assigneeName: tasks.find((task) => task.status !== "DONE")?.assigneeName ?? null,
    containerCount: containers.length,
    updatedAt: iso(snapshot - hour / 4),
    requiredSetPointCelsius: -18,
    siSealNo: scenario === 5 ? `SL-OLD-${suffix}` : sealNo,
    seafoodProfile,
    containers,
    documents,
    checks,
    tasks,
    auditEvents: [
      {
        id: `EVT-${suffix}`,
        actorName: completed ? departments.TRANSPORT.name : "Hệ thống giả lập",
        action: completed ? "GATE_IN_CONFIRMED" : "BOOKING_REVIEWED",
        description: completed ? "Đã xác nhận vào bãi từ chứng từ giả lập." : "Đã đối chiếu booking phiên bản 2.",
        createdAt: iso(snapshot - 2 * hour),
      },
      ...tasks.filter((task) => task.status !== "OPEN").map((task, position) => ({
        id: `EVT-${suffix}-TASK-${position + 1}`,
        actorName: task.assigneeName,
        action: task.status === "DONE" ? "TASK_COMPLETED" : "TASK_STARTED",
        description: task.status === "DONE"
          ? `Đã hoàn tất ${task.title.toLowerCase()}; bằng chứng ${task.evidenceDocumentId}.`
          : `Đã bắt đầu ${task.title.toLowerCase()} trước hạn ${task.dueAt}.`,
        createdAt: task.updatedAt,
      })),
    ],
  };
}

const shipments = Array.from({ length: 500 }, (_, index) => shipment(index));
await mkdir(path.join(root, "data"), { recursive: true });
await writeFile(path.join(root, "data", "shipments.json"), `${JSON.stringify(shipments, null, 2)}\n`, "utf8");
console.log(`Generated ${shipments.length} orders and ${shipments.reduce((n, item) => n + item.containerCount, 0)} containers.`);
